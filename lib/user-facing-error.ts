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

  constructor(
    public readonly payload: UserFacingErrorPayload,
    options?: ErrorOptions,
  ) {
    super(payload.title, options);
    this.name = 'UserFacingError';
    this.digest = SENTINEL + JSON.stringify(payload);
  }
}

export const isUserFacingErrorPayload = (
  value: unknown,
): value is UserFacingErrorPayload => {
  const payload = value as Record<string, unknown> | null;
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof payload.title === 'string' &&
    typeof payload.description === 'string' &&
    (payload.retryable === undefined || typeof payload.retryable === 'boolean')
  );
};

export const parseUserFacingDigest = (
  digest: string | undefined,
): UserFacingErrorPayload | null => {
  if (!digest || !digest.startsWith(SENTINEL)) return null;
  try {
    const parsed: unknown = JSON.parse(digest.slice(SENTINEL.length));
    if (isUserFacingErrorPayload(parsed)) return parsed;
  } catch {
    // fall through
  }
  return null;
};
