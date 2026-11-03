import { initLogger, log, type WideEvent } from 'evlog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { measureLookup } from './lookup-observability';

afterEach(() => {
  vi.restoreAllMocks();
  initLogger({ enabled: false });
});

describe('lookup observability', () => {
  it('preserves nested causes through evlog production serialization', async () => {
    const events: WideEvent[] = [];
    initLogger({
      enabled: true,
      silent: true,
      pretty: false,
      redact: false,
      drain: ({ event }) => {
        events.push(event);
      },
    });
    log.warn({
      message: 'lookup_failed',
      error: new Error('outer', {
        cause: new Error('middle', { cause: new Error('root cause') }),
      }),
    });
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(JSON.parse(JSON.stringify(events[0]))).toMatchObject({
      error: {
        message: 'outer',
        cause: { message: 'middle', cause: { message: 'root cause' } },
      },
    });
  });

  it('records stage duration without changing returned availability states', async () => {
    const info = vi.spyOn(log, 'info').mockImplementation(() => {});
    const unavailable = { status: 'unavailable' };
    expect(
      await measureLookup(
        'dnssec_summary',
        'example.com',
        async () => unavailable,
      ),
    ).toBe(unavailable);
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'dnssec_summary',
        domain: 'example.com',
        durationMs: expect.any(Number),
        outcome: 'returned',
      }),
    );
  });

  it('logs and rethrows the original error when a stage rejects', async () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => {});
    const error = new Error('upstream failed');
    await expect(
      measureLookup('registration_summary', 'example.com', async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'lookup_stage_failed', error }),
    );
  });
});
