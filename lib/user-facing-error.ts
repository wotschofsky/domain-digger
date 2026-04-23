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

type UpstreamErrorOptions = {
  service: string;
  status?: number;
};

export const upstreamUserFacingError = ({
  service,
  status,
}: UpstreamErrorOptions): UserFacingError => {
  if (status === 429) {
    return new UserFacingError({
      title: 'Rate limited',
      description: `${service} is currently rate limiting our requests. Please wait a moment and try again.`,
      retryable: true,
    });
  }
  if (status !== undefined && status >= 500) {
    return new UserFacingError({
      title: `${service} is unavailable`,
      description: `${service} returned an error and may be temporarily down. Please try again shortly.`,
      retryable: true,
    });
  }
  return new UserFacingError({
    title: `Couldn't reach ${service}`,
    description: `We couldn't complete the request to ${service}. Please try again shortly.`,
    retryable: true,
  });
};
