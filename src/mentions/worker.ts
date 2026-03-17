import { classifyFailure } from '../core/failure-classifier';
import { processMention } from '../app/process-mention';
import { DedupeStore } from '../core/dedupe-store';
import { logEvent } from '../core/logger';
import { MetricsStore } from '../core/metrics-store';
import type { SovaXEnv } from '../config/env';
import { SdkIntelClient } from '../intel/client';
import { DexscreenerTokenMetadataClient } from '../metadata/client';
import { MentionStore } from './store';
import { renderSvgToPngBuffer } from '../render/png';
import type { XMention } from '../types/x';
import { postReply } from '../x/reply-poster';
import { XClient } from '../x/x-client';

export class MentionWorker {
  private readonly maxProcessingAttempts: number = 3;
  private readonly retryBaseDelayMs: number;
  private readonly store: MentionStore;
  private readonly dedupeStore: DedupeStore;
  private readonly metricsStore: MetricsStore;
  private readonly readClient: XClient;
  private readonly intelClient: SdkIntelClient;
  private readonly metadataClient: DexscreenerTokenMetadataClient;

  constructor(private readonly env: SovaXEnv) {
    if (!env.xBearerToken || !env.xBotUserId) {
      throw new Error('X_BEARER_TOKEN and X_BOT_USER_ID are required for mention polling.');
    }

    if (!env.sovaIntelApiKey) {
      throw new Error('SOVA_INTEL_API_KEY is required for mention polling.');
    }

    this.store = new MentionStore(env.outputDir);
    this.retryBaseDelayMs = env.pollIntervalMs;
    this.dedupeStore = new DedupeStore(env.outputDir);
    this.metricsStore = new MetricsStore(env.outputDir);
    this.readClient = new XClient(env.xApiBaseUrl, { kind: 'bearer', token: env.xBearerToken });
    this.intelClient = new SdkIntelClient({
      baseUrl: env.sovaIntelBaseUrl,
      apiKey: env.sovaIntelApiKey,
      pollIntervalMs: env.pollIntervalMs,
    });
    this.metadataClient = new DexscreenerTokenMetadataClient();
  }

  async runForever(): Promise<void> {
    while (true) {
      try {
        await this.pollOnce();
      } catch (error: unknown) {
        console.error('[mention-worker] poll failed', toErrorMessage(error));
      }

      await delay(this.env.pollIntervalMs);
    }
  }

  async pollOnce(): Promise<void> {
    const sinceId: string | null = await this.store.getLastSeenMentionId();
    const mentions = await this.readClient.getMentions(this.env.xBotUserId!, sinceId ?? undefined);
    if (mentions.length === 0) {
      return;
    }
    await this.metricsStore.increment('mentionsRead', mentions.length);
    logEvent('mentions.poll.completed', {
      mode: 'mention',
      fetchedCount: mentions.length,
      sinceId,
    });

    const sortedMentions = [...mentions].sort(compareTweetIdsAscending);
    for (const mention of sortedMentions) {
      await this.handleMention(mention);
    }

    const newestMentionId = sortedMentions[sortedMentions.length - 1]?.id;
    if (newestMentionId) {
      await this.store.setLastSeenMentionId(newestMentionId);
    }
  }

  private async handleMention(mention: XMention): Promise<void> {
    if (await this.store.hasMention(mention.id)) {
      return;
    }

    if (mention.authorId === this.env.xBotUserId && !this.env.xAllowedCallerIds.includes(mention.authorId)) {
      await this.metricsStore.increment('mentionsIgnored');
      await this.store.createMention({
        mentionId: mention.id,
        targetTweetId: mention.id,
        authorId: mention.authorId,
        authorUsername: mention.authorUsername,
        mint: null,
        status: 'ignored',
        reason: 'self-mention',
      });
      logEvent('mention.ignored', {
        mentionId: mention.id,
        mode: 'mention',
        reason: 'self-mention',
        triggerTweetId: mention.id,
      });
      return;
    }

    if (!this.env.xAllowedCallerIds.includes(mention.authorId)) {
      await this.metricsStore.increment('mentionsIgnored');
      await this.store.createMention({
        mentionId: mention.id,
        targetTweetId: mention.id,
        authorId: mention.authorId,
        authorUsername: mention.authorUsername,
        mint: null,
        status: 'ignored',
        reason: 'unauthorized author',
      });
      logEvent('mention.ignored', {
        mentionId: mention.id,
        mode: 'mention',
        reason: 'unauthorized author',
        triggerTweetId: mention.id,
      });
      return;
    }

    await this.metricsStore.increment('validOperatorTriggers');
    await this.handleAuthorizedMention(mention);
  }

  private async handleAuthorizedMention(mention: XMention): Promise<void> {
    for (let attempt = 1; attempt <= this.maxProcessingAttempts; attempt += 1) {
      try {
        const processed = await processMention({
          mention,
          intelClient: this.intelClient,
          metadataClient: this.metadataClient,
          topN: this.env.defaultTopN,
        });

        if (processed.status !== 'ready') {
          await this.metricsStore.increment('mentionsIgnored');
          await this.store.createMention({
            mentionId: mention.id,
            targetTweetId: mention.id,
            authorId: mention.authorId,
            authorUsername: mention.authorUsername,
            mint: null,
            status: 'ignored',
            reason: 'invalid mint',
            retryCount: attempt - 1,
          });
          logEvent('mention.ignored', {
            mentionId: mention.id,
            mode: 'mention',
            reason: 'invalid mint',
            triggerTweetId: mention.id,
          });
          return;
        }

        const dedupeClaimed = await this.dedupeStore.claimTargetMint(mention.id, processed.mint, mention.id);
        if (!dedupeClaimed) {
          await this.metricsStore.increment('mentionsIgnored');
          await this.store.createMention({
            mentionId: mention.id,
            targetTweetId: mention.id,
            authorId: mention.authorId,
            authorUsername: mention.authorUsername,
            mint: processed.mint,
            status: 'ignored',
            reason: 'duplicate',
            retryCount: attempt - 1,
          });
          logEvent('mention.ignored', {
            mentionId: mention.id,
            mode: 'mention',
            mint: processed.mint,
            reason: 'duplicate',
            triggerTweetId: mention.id,
          });
          return;
        }

        if (this.env.disablePosting) {
          await this.ignoreReadyMention(mention, processed.mint, 'posting disabled', attempt - 1);
          return;
        }

        if (this.env.previewOnlyMode) {
          await this.ignoreReadyMention(mention, processed.mint, 'preview-only mode', attempt - 1);
          return;
        }

        if (this.env.mentionDryRunMode) {
          await this.ignoreReadyMention(mention, processed.mint, 'dry-run mode', attempt - 1);
          return;
        }

        logEvent('mention.post.started', {
          mentionId: mention.id,
          mode: 'mention',
          mint: processed.mint,
          triggerTweetId: mention.id,
          attempt,
        });
        await this.store.markPosting({
          mentionId: mention.id,
          targetTweetId: mention.id,
          authorId: mention.authorId,
          authorUsername: mention.authorUsername,
          mint: processed.mint,
          retryCount: attempt - 1,
        });
        const png: Buffer = await renderSvgToPngBuffer(processed.socialCardSvg);
        const posted = await postReply({
          env: this.env,
          replyText: processed.replyText,
          replyToTweetId: mention.id,
          png,
        });
        await this.store.createMention({
          mentionId: mention.id,
          targetTweetId: mention.id,
          authorId: mention.authorId,
          authorUsername: mention.authorUsername,
          mint: processed.mint,
          status: 'posted',
          reason: posted.usedTextOnlyFallback ? 'text-only fallback' : null,
          retryCount: attempt - 1,
          replyTweetId: posted.postedReplyId,
        });
        await this.metricsStore.increment('repliesPosted');
        logEvent('mention.post.completed', {
          mentionId: mention.id,
          mode: 'mention',
          mint: processed.mint,
          triggerTweetId: mention.id,
          replyTweetId: posted.postedReplyId,
          usedTextOnlyFallback: posted.usedTextOnlyFallback,
          attempt,
        });
        return;
      } catch (error: unknown) {
        const classified = classifyFailure(error);
        logEvent('mention.processing.error', {
          mentionId: mention.id,
          mode: 'mention',
          triggerTweetId: mention.id,
          attempt,
          failureClass: classified.failureClass,
          retryable: classified.retryable,
          error: classified.message,
        });

        if (classified.retryable && attempt < this.maxProcessingAttempts) {
          await delay(this.retryBaseDelayMs * attempt);
          continue;
        }

        await this.store.createMention({
          mentionId: mention.id,
          targetTweetId: mention.id,
          authorId: mention.authorId,
          authorUsername: mention.authorUsername,
          mint: null,
          status: 'failed',
          reason: classified.message,
          failureClass: classified.failureClass,
          retryCount: attempt,
        });
        logEvent('mention.post.failed', {
          mentionId: mention.id,
          mode: 'mention',
          triggerTweetId: mention.id,
          failureClass: classified.failureClass,
          retryCount: attempt,
          error: classified.message,
        });
        return;
      }
    }
  }

  private async ignoreReadyMention(
    mention: XMention,
    mint: string,
    reason: string,
    retryCount: number,
  ): Promise<void> {
    await this.metricsStore.increment('mentionsIgnored');
    await this.store.createMention({
      mentionId: mention.id,
      targetTweetId: mention.id,
      authorId: mention.authorId,
      authorUsername: mention.authorUsername,
      mint,
      status: 'ignored',
      reason,
      retryCount,
    });
    logEvent('mention.ignored', {
      mentionId: mention.id,
      mode: 'mention',
      mint,
      reason,
      triggerTweetId: mention.id,
    });
  }
}

function compareTweetIdsAscending(left: XMention, right: XMention): number {
  const leftId = BigInt(left.id);
  const rightId = BigInt(right.id);
  if (leftId === rightId) {
    return 0;
  }

  return leftId < rightId ? -1 : 1;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
