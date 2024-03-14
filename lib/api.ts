import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type Unit = 'ms' | 's' | 'm' | 'h' | 'd';
type Duration = `${number} ${Unit}` | `${number}${Unit}`;

export const applyRateLimit = async (
  identifier: string,
  tokens: number,
  window: Duration
) => {
  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: true,
  });
  const result = await limiter.limit(identifier);
  return result.success;
};
