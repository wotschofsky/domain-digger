import { beforeEach, describe, expect, it, vi } from 'vitest';

const logger = {
  set: vi.fn(),
  setLevel: vi.fn(),
  warn: vi.fn(),
};

vi.mock('@/lib/evlog', () => ({
  useLogger: () => logger,
  withEvlog:
    <TArgs extends unknown[], TReturn>(handler: (...args: TArgs) => TReturn) =>
    (...args: TArgs) =>
      handler(...args),
}));

const { POST } = await import('./route');

describe('client log ingestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds valid client logs to the traced request event', async () => {
    const response = await POST(
      new Request('http://localhost/api/_evlog/ingest', {
        method: 'POST',
        body: JSON.stringify({
          level: 'error',
          timestamp: '2026-07-31T12:00:00.000Z',
          service: 'domain-digger',
          action: 'lookup_failed',
        }),
      }),
    );

    expect(response.status).toBe(204);
    expect(logger.setLevel).toHaveBeenCalledWith('error');
    expect(logger.set).toHaveBeenCalledWith({
      source: 'client',
      clientLog: {
        timestamp: '2026-07-31T12:00:00.000Z',
        service: 'domain-digger',
        action: 'lookup_failed',
      },
    });
  });

  it('rejects malformed client logs', async () => {
    const response = await POST(
      new Request('http://localhost/api/_evlog/ingest', {
        method: 'POST',
        body: JSON.stringify({ message: 'missing required fields' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(logger.warn).toHaveBeenCalledWith(
      'Rejected an invalid client log',
      expect.objectContaining({ source: 'client' }),
    );
    expect(logger.set).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON rather than failing the traced request', async () => {
    const response = await POST(
      new Request('http://localhost/api/_evlog/ingest', {
        method: 'POST',
        body: '{',
      }),
    );

    expect(response.status).toBe(400);
    expect(logger.warn).toHaveBeenCalledWith(
      'Rejected an invalid client log',
      expect.objectContaining({ source: 'client' }),
    );
  });

  it('rejects a body whose declared content length exceeds the limit', async () => {
    const request = new Request('http://localhost/api/_evlog/ingest', {
      method: 'POST',
      body: JSON.stringify({
        level: 'info',
        timestamp: '2026-07-31T12:00:00.000Z',
        service: 'domain-digger',
      }),
    });
    request.headers.set('content-length', String(100 * 1024 + 1));
    const readBody = vi.spyOn(request, 'text');

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(readBody).not.toHaveBeenCalled();
    expect(logger.set).not.toHaveBeenCalled();
  });

  it('rejects an oversized UTF-8 body without a content length', async () => {
    const body = JSON.stringify({
      level: 'info',
      timestamp: '2026-07-31T12:00:00.000Z',
      service: 'domain-digger',
      message: '€'.repeat(35_000),
    });
    const request = new Request('http://localhost/api/_evlog/ingest', {
      method: 'POST',
      body,
    });
    request.headers.delete('content-length');

    const response = await POST(request);

    expect(body.length).toBeLessThan(100 * 1024);
    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(
      100 * 1024,
    );
    expect(response.status).toBe(413);
    expect(logger.set).not.toHaveBeenCalled();
  });
});
