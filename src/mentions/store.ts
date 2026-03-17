import path from 'node:path';
import { mutateJsonFile, readJsonFile } from '../core/json-file-store';

export type MentionRunStatus = 'ignored' | 'failed' | 'posted' | 'posting';

export type MentionRunRecord = {
  mentionId: string;
  targetTweetId: string;
  authorId: string;
  authorUsername: string | null;
  mint: string | null;
  status: MentionRunStatus;
  reason: string | null;
  failureClass: string | null;
  retryCount: number;
  replyTweetId: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

type MentionStoreState = {
  lastSeenMentionId: string | null;
  mentions: MentionRunRecord[];
};

const MAX_MENTION_RUNS: number = 2000;
const STALE_POSTING_REASON: string = 'Interrupted during posting before completion was recorded. Manual review required.';

export class MentionStore {
  private readonly filePath: string;

  constructor(outputDir: string) {
    this.filePath = path.join(outputDir, 'mention-state.json');
  }

  async getLastSeenMentionId(): Promise<string | null> {
    const state = await this.readState();
    return state.lastSeenMentionId;
  }

  async setLastSeenMentionId(mentionId: string): Promise<void> {
    await this.mutateState((state) => {
      state.lastSeenMentionId = mentionId;
    });
  }

  async hasMention(mentionId: string): Promise<boolean> {
    const state = await this.readState();
    return state.mentions.some((mention) => mention.mentionId === mentionId);
  }

  async failIfStalePosting(mentionId: string, staleAfterMs: number): Promise<MentionRunRecord | null> {
    let updated: MentionRunRecord | null = null;
    await this.mutateState((state) => {
      const existing = state.mentions.find((mention) => mention.mentionId === mentionId);
      if (!existing || existing.status !== 'posting') {
        return;
      }

      const ageMs: number = Date.now() - Date.parse(existing.updatedAtIso);
      if (!Number.isFinite(ageMs) || ageMs < staleAfterMs) {
        return;
      }

      existing.status = 'failed';
      existing.reason = STALE_POSTING_REASON;
      existing.failureClass = 'permanent';
      existing.updatedAtIso = new Date().toISOString();
      updated = { ...existing };
    });
    return updated;
  }

  async markPosting(input: {
    mentionId: string;
    targetTweetId: string;
    authorId: string;
    authorUsername: string | null;
    mint: string;
    retryCount: number;
  }): Promise<void> {
    await this.upsertMention({
      mentionId: input.mentionId,
      targetTweetId: input.targetTweetId,
      authorId: input.authorId,
      authorUsername: input.authorUsername,
      mint: input.mint,
      status: 'posting',
      reason: null,
      retryCount: input.retryCount,
    });
  }

  async createMention(input: {
    mentionId: string;
    targetTweetId: string;
    authorId: string;
    authorUsername: string | null;
    mint: string | null;
    status: MentionRunStatus;
    reason: string | null;
    failureClass?: string | null;
    retryCount?: number;
    replyTweetId?: string | null;
  }): Promise<void> {
    await this.upsertMention(input);
  }

  private async upsertMention(input: {
    mentionId: string;
    targetTweetId: string;
    authorId: string;
    authorUsername: string | null;
    mint: string | null;
    status: MentionRunStatus;
    reason: string | null;
    failureClass?: string | null;
    retryCount?: number;
    replyTweetId?: string | null;
  }): Promise<void> {
    const nowIso: string = new Date().toISOString();
    await this.mutateState((state) => {
      const existing = state.mentions.find((mention) => mention.mentionId === input.mentionId);
      if (existing) {
        existing.targetTweetId = input.targetTweetId;
        existing.authorId = input.authorId;
        existing.authorUsername = input.authorUsername;
        existing.mint = input.mint;
        existing.status = input.status;
        existing.reason = input.reason;
        existing.failureClass = input.failureClass ?? null;
        existing.retryCount = input.retryCount ?? existing.retryCount;
        existing.replyTweetId = input.replyTweetId ?? null;
        existing.updatedAtIso = nowIso;
        return;
      }

      state.mentions.push({
        mentionId: input.mentionId,
        targetTweetId: input.targetTweetId,
        authorId: input.authorId,
        authorUsername: input.authorUsername,
        mint: input.mint,
        status: input.status,
        reason: input.reason,
        failureClass: input.failureClass ?? null,
        retryCount: input.retryCount ?? 0,
        replyTweetId: input.replyTweetId ?? null,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      });
      pruneMentions(state);
    });
  }

  private async mutateState(mutate: (state: MentionStoreState) => void): Promise<void> {
    await mutateJsonFile(this.filePath, createDefaultState, (state) => {
      mutate(state);
      pruneMentions(state);
    });
  }

  private async readState(): Promise<MentionStoreState> {
    const parsed = await readJsonFile<Partial<MentionStoreState>>(this.filePath, createDefaultState);
    return {
      lastSeenMentionId: typeof parsed.lastSeenMentionId === 'string' ? parsed.lastSeenMentionId : null,
      mentions: Array.isArray(parsed.mentions) ? parsed.mentions as MentionRunRecord[] : [],
    };
  }
}

function createDefaultState(): MentionStoreState {
  return {
    lastSeenMentionId: null,
    mentions: [],
  };
}

function pruneMentions(state: MentionStoreState): void {
  if (state.mentions.length <= MAX_MENTION_RUNS) {
    return;
  }

  state.mentions = [...state.mentions]
    .sort((left, right) => left.createdAtIso.localeCompare(right.createdAtIso))
    .slice(-MAX_MENTION_RUNS);
}
