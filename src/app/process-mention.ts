import { extractSingleMintFromMention } from '../core/solana';
import { buildReplyContent } from './build-reply-content';
import type { IntelClient } from '../intel/client';
import type { TokenMetadataClient } from '../metadata/client';
import type { XMention } from '../types/x';

export type ProcessMentionResult =
  | { status: 'ignored'; reason: string }
  | {
      status: 'ready';
      mint: string;
      replyText: string;
      socialCardSvg: string;
    };

export async function processMention(params: {
  mention: XMention;
  intelClient: IntelClient;
  metadataClient: TokenMetadataClient;
  topN: number;
}): Promise<ProcessMentionResult> {
  const mint: string | null = extractSingleMintFromMention(params.mention.text);
  if (!mint) {
    return { status: 'ignored', reason: 'Mention did not contain exactly one mint candidate.' };
  }

  const reply = await buildReplyContent({
    mint,
    intelClient: params.intelClient,
    metadataClient: params.metadataClient,
    topN: params.topN,
  });
  return {
    status: 'ready',
    mint: reply.mint,
    replyText: reply.replyText,
    socialCardSvg: reply.socialCardSvg,
  };
}
