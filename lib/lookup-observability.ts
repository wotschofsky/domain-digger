import { log } from 'evlog';

// "Returned" means the operation resolved, not that it found complete data.
// Interpret availability from the summary event's individual returned states.
export const measureLookup = async <T>(
  operation: string,
  domain: string,
  lookup: () => Promise<T>,
): Promise<T> => {
  const startedAt = Date.now();
  try {
    const result = await lookup();
    log.info({
      message: 'lookup_stage_completed',
      operation,
      domain,
      durationMs: Date.now() - startedAt,
      outcome: 'returned',
    });
    return result;
  } catch (error) {
    log.warn({
      message: 'lookup_stage_failed',
      operation,
      domain,
      durationMs: Date.now() - startedAt,
      error,
    });
    throw error;
  }
};
