import type { SovaXEnv } from '../config/env';
import { XMediaClient } from './media-client';
import { XClient } from './x-client';

export type PostReplyResult = {
  postedReplyId: string;
  usedTextOnlyFallback: boolean;
  mediaErrorMessage?: string;
};

export async function postReply(params: {
  env: SovaXEnv;
  replyText: string;
  replyToTweetId: string;
  png: Buffer;
}): Promise<PostReplyResult> {
  const auth = buildPostAuth(params.env);
  const xClient = new XClient(params.env.xApiBaseUrl, auth);
  const mediaClient = new XMediaClient(params.env.xApiBaseUrl, auth);

  let uploaded: Awaited<ReturnType<XMediaClient['uploadPng']>>;
  try {
    uploaded = await mediaClient.uploadPng(params.png);
  } catch (mediaError: unknown) {
    const post = await xClient.createPost({
      text: params.replyText,
      replyToTweetId: params.replyToTweetId,
    });
    return {
      postedReplyId: post.id,
      usedTextOnlyFallback: true,
      mediaErrorMessage: mediaError instanceof Error ? mediaError.message : 'Unknown media error',
    };
  }

  const post = await xClient.createPost({
    text: params.replyText,
    replyToTweetId: params.replyToTweetId,
    mediaIds: [uploaded.mediaId],
  });
  return {
    postedReplyId: post.id,
    usedTextOnlyFallback: false,
  };
}

function buildPostAuth(env: SovaXEnv):
  | { kind: 'bearer'; token: string }
  | {
      kind: 'oauth1';
      credentials: {
        consumerKey: string;
        consumerSecret: string;
        accessToken: string;
        accessTokenSecret: string;
      };
    } {
  if (env.xConsumerKey && env.xConsumerSecret && env.xAccessToken && env.xAccessTokenSecret) {
    return {
      kind: 'oauth1',
      credentials: {
        consumerKey: env.xConsumerKey,
        consumerSecret: env.xConsumerSecret,
        accessToken: env.xAccessToken,
        accessTokenSecret: env.xAccessTokenSecret,
      },
    };
  }

  if (env.xOAuth2AccessToken) {
    return { kind: 'bearer', token: env.xOAuth2AccessToken };
  }

  throw new Error('Posting requires X_OAUTH2_ACCESS_TOKEN or the OAuth 1.0a credential set in sova-x/.env');
}
