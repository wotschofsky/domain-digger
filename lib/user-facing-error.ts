// Next.js redacts `error.message` for server-thrown errors in production but
// forwards `error.digest` verbatim (this is how internal sentinels like
// NEXT_REDIRECT and NEXT_HTTP_ERROR_FALLBACK;404 reach the client). We piggy-
// back on that channel: the constructor sets a custom digest containing the
// JSON payload, and `error.tsx` boundaries decode it back.

const SENTINEL = '__USER_FACING_ERROR__:';

export type UserFacingErrorPayload = {
  title: string;
  description: string;
  retryable?: boolean;
};

export class UserFacingError extends Error {
  public readonly digest: string;

  constructor(public readonly payload: UserFacingErrorPayload) {
    super(payload.title);
    this.name = 'UserFacingError';
    this.digest = SENTINEL + JSON.stringify(payload);
  }
}

export const parseUserFacingDigest = (
  digest: string | undefined,
): UserFacingErrorPayload | null => {
  if (!digest || !digest.startsWith(SENTINEL)) return null;
  try {
    const parsed = JSON.parse(digest.slice(SENTINEL.length));
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.title === 'string' &&
      typeof parsed.description === 'string' &&
      (parsed.retryable === undefined || typeof parsed.retryable === 'boolean')
    ) {
      return parsed as UserFacingErrorPayload;
    }
  } catch {
    // fall through
  }
  return null;
};
