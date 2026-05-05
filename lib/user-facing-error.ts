// Next.js only exposes `message` and `digest` to the client error boundary,
// and in production replaces `message` with a generic string. To propagate a
// safe, human-readable message to the boundary, we encode a structured
// payload into `message` behind a sentinel prefix that the boundary decodes.

const SENTINEL = '__USER_FACING_ERROR__:';

export type UserFacingErrorPayload = {
  title: string;
  description: string;
  retryable?: boolean;
};

export class UserFacingError extends Error {
  public readonly userFacing = true;

  constructor(public readonly payload: UserFacingErrorPayload) {
    super(SENTINEL + JSON.stringify(payload));
    this.name = 'UserFacingError';
  }
}

export const parseUserFacingError = (
  message: string | undefined,
): UserFacingErrorPayload | null => {
  if (!message || !message.startsWith(SENTINEL)) return null;
  try {
    const parsed = JSON.parse(message.slice(SENTINEL.length));
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.title === 'string' &&
      typeof parsed.description === 'string'
    ) {
      return parsed as UserFacingErrorPayload;
    }
  } catch {
    // fall through
  }
  return null;
};
