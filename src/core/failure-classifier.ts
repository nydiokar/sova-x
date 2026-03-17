export type FailureClass =
  | 'transient_x'
  | 'reply_restricted'
  | 'x_auth'
  | 'analyzer_unavailable'
  | 'permanent';

export type ClassifiedFailure = {
  failureClass: FailureClass;
  retryable: boolean;
  message: string;
};

export function classifyFailure(error: unknown): ClassifiedFailure {
  const message: string = error instanceof Error ? error.message : 'Unknown error';
  const normalized: string = message.toLowerCase();

  if (
    normalized.includes('reply') &&
    (normalized.includes('conversation') || normalized.includes('restricted') || normalized.includes('not authorized'))
  ) {
    return { failureClass: 'reply_restricted', retryable: false, message };
  }

  if (normalized.includes('401') || normalized.includes('oauth') || normalized.includes('access token')) {
    return { failureClass: 'x_auth', retryable: false, message };
  }

  if (
    normalized.includes('429') ||
    normalized.includes('500') ||
    normalized.includes('502') ||
    normalized.includes('503') ||
    normalized.includes('504') ||
    normalized.includes('econnreset') ||
    normalized.includes('etimedout') ||
    normalized.includes('network')
  ) {
    return { failureClass: 'transient_x', retryable: true, message };
  }

  if (
    normalized.includes('sova') ||
    normalized.includes('intel') ||
    normalized.includes('sdk') ||
    normalized.includes('fetch failed') ||
    normalized.includes('unavailable')
  ) {
    return { failureClass: 'analyzer_unavailable', retryable: true, message };
  }

  return { failureClass: 'permanent', retryable: false, message };
}
