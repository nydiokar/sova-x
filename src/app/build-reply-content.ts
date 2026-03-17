import { buildHolderDistributionSummary, buildReplyText } from '../core/summary';
import type { IntelClient } from '../intel/client';
import type { TokenMetadataClient } from '../metadata/client';
import { renderSocialCardSvg } from '../render/social-card';

export type ReplyContent = {
  mint: string;
  replyText: string;
  socialCardSvg: string;
};

export async function buildReplyContent(params: {
  mint: string;
  intelClient: IntelClient;
  metadataClient: TokenMetadataClient;
  topN: number;
}): Promise<ReplyContent> {
  const [result, metadata] = await Promise.all([
    params.intelClient.pollHolderProfiles(params.mint, params.topN),
    params.metadataClient.getTokenMetadata(params.mint),
  ]);

  const summary = buildHolderDistributionSummary(result, metadata, params.topN);
  return {
    mint: params.mint,
    replyText: buildReplyText(summary),
    socialCardSvg: renderSocialCardSvg(summary),
  };
}
