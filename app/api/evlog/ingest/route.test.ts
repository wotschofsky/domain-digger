import { beforeEach, describe, expect, it, vi } from 'vitest';

const logger = {
  set: vi.fn(),
  setLevel: vi.fn(),
  warn: vi.fn(),
};

const createRequest = (
  body: string,
  {
    url = 'http://localhost/api/_evlog/ingest',
    origin = 'http://localhost',
    referer,
    contentType,
  }: {
    url?: string;
    origin?: string | null;
    referer?: string;
    contentType?: string;
  } = {},
) => {
  const request = new Request(url, { method: 'POST', body });

  if (origin !== null) request.headers.set('origin', origin);
  if (referer !== undefined) request.headers.set('referer', referer);
  if (contentType !== undefined)
    request.headers.set('content-type', contentType);

  return request;
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
      createRequest(
        JSON.stringify({
          level: 'error',
          timestamp: '2026-07-31T12:00:00.000Z',
          service: 'domain-digger',
          action: 'lookup_failed',
        }),
      ),
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

  it('accepts a same-host Referer when Origin is absent', async () => {
    const response = await POST(
      createRequest(
        JSON.stringify({
          level: 'info',
          timestamp: '2026-07-31T12:00:00.000Z',
          service: 'domain-digger',
        }),
        {
          origin: null,
          referer: 'http://localhost/lookup/example.com',
        },
      ),
    );

    expect(response.status).toBe(204);
    expect(logger.setLevel).toHaveBeenCalledWith('info');
  });

  it('rejects cross-origin text/plain requests before reading the body', async () => {
    const request = createRequest(
      JSON.stringify({
        level: 'error',
        timestamp: '2026-07-31T12:00:00.000Z',
        service: 'domain-digger',
        action: 'forged_log',
      }),
      {
        url: 'https://domain-digger.example/api/evlog/ingest',
        origin: 'https://attacker.example',
        referer: 'https://domain-digger.example/lookup/example.com',
        contentType: 'text/plain',
      },
    );
    const readBody = vi.spyOn(request, 'text');

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(readBody).not.toHaveBeenCalled();
    expect(logger.setLevel).not.toHaveBeenCalled();
    expect(logger.set).not.toHaveBeenCalled();
  });

  it('rejects requests without an Origin or Referer', async () => {
    const request = createRequest(
      JSON.stringify({
        level: 'warn',
        timestamp: '2026-07-31T12:00:00.000Z',
        service: 'domain-digger',
      }),
      { origin: null },
    );
    const readBody = vi.spyOn(request, 'text');

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(readBody).not.toHaveBeenCalled();
    expect(logger.setLevel).not.toHaveBeenCalled();
    expect(logger.set).not.toHaveBeenCalled();
  });

  it('rejects malformed client logs', async () => {
    const response = await POST(
      createRequest(JSON.stringify({ message: 'missing required fields' })),
    );

    expect(response.status).toBe(400);
    expect(logger.warn).toHaveBeenCalledWith(
      'Rejected an invalid client log',
      expect.objectContaining({ source: 'client' }),
    );
    expect(logger.set).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON rather than failing the traced request', async () => {
    const response = await POST(createRequest('{'));

    expect(response.status).toBe(400);
    expect(logger.warn).toHaveBeenCalledWith(
      'Rejected an invalid client log',
      expect.objectContaining({ source: 'client' }),
    );
  });

  it('rejects a body whose declared content length exceeds the limit', async () => {
    const request = createRequest(
      JSON.stringify({
        level: 'info',
        timestamp: '2026-07-31T12:00:00.000Z',
        service: 'domain-digger',
      }),
    );
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
    const request = createRequest(body);
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
