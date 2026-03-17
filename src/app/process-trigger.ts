import { buildReplyContent } from './build-reply-content';
import { extractSingleMintFromMention } from '../core/solana';
import { parseXPostUrl } from '../core/x-post-url';
import type { IntelClient } from '../intel/client';
import type { TokenMetadataClient } from '../metadata/client';

export type ProcessTriggerResult =
  | { status: 'ignored'; reason: string }
  | {
      status: 'ready';
      tweetId: string;
      normalizedTweetUrl: string;
      mint: string;
      replyText: string;
      socialCardSvg: string;
    };

export async function processTrigger(params: {
  tweetUrl: string;
  mint: string;
  intelClient: IntelClient;
  metadataClient: TokenMetadataClient;
  topN: number;
}): Promise<ProcessTriggerResult> {
  const parsedUrl = parseXPostUrl(params.tweetUrl);
  if (!parsedUrl) {
    return { status: 'ignored', reason: 'Target X post URL is invalid.' };
  }

  const mint: string | null = extractSingleMintFromMention(params.mint);
  if (!mint) {
    return { status: 'ignored', reason: 'Mint input did not contain exactly one Solana mint candidate.' };
  }

  const reply = await buildReplyContent({
    mint,
    intelClient: params.intelClient,
    metadataClient: params.metadataClient,
    topN: params.topN,
  });
  return {
    status: 'ready',
    tweetId: parsedUrl.tweetId,
    normalizedTweetUrl: parsedUrl.normalizedUrl,
    mint: reply.mint,
    replyText: reply.replyText,
    socialCardSvg: reply.socialCardSvg,
  };
}
