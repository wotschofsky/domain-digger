import { log } from 'evlog';

// outcome 'returned' only means the lookup resolved; availability lives in the summary event.
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
