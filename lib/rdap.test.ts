import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getRdapSummary } from './rdap';

const fetchMock = vi.fn<typeof fetch>();
const bootstrap = () =>
  Response.json({ services: [[['com'], ['https://rdap.example/com/v1/']]] });
const domain = {
  objectClassName: 'domain',
  ldhName: 'EXAMPLE.COM',
  events: [{ eventAction: 'registration', eventDate: '2000-01-02T00:00:00Z' }],
  entities: [
    {
      roles: ['registrar'],
      vcardArray: ['vcard', [['fn', {}, 'text', 'Example registrar']]],
    },
  ],
  secureDNS: { delegationSigned: true },
};

describe('RDAP registration summary', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });
  it('discovers the service and extracts registry registration data', async () => {
    fetchMock
      .mockResolvedValueOnce(bootstrap())
      .mockResolvedValueOnce(Response.json(domain));
    await expect(getRdapSummary('example.com')).resolves.toEqual({
      registered: true,
      registrar: 'Example registrar',
      createdAt: '2000-01-02',
      dnssec: 'signed',
    });
    expect(fetchMock.mock.calls[1][0].toString()).toBe(
      'https://rdap.example/com/v1/domain/example.com',
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ redirect: 'error' });
  });
  it('only treats a proper RDAP 404 as an unregistered domain', async () => {
    fetchMock
      .mockResolvedValueOnce(bootstrap())
      .mockResolvedValueOnce(
        Response.json({ errorCode: 404 }, { status: 404 }),
      );
    await expect(getRdapSummary('example.com')).resolves.toEqual({
      registered: false,
    });
    fetchMock
      .mockResolvedValueOnce(bootstrap())
      .mockResolvedValueOnce(
        new Response('not a registry response', { status: 404 }),
      );
    await expect(getRdapSummary('example.com')).rejects.toThrow();
  });
  it('returns no service for an unsupported suffix and rejects mismatched domains', async () => {
    fetchMock.mockResolvedValueOnce(bootstrap());
    await expect(getRdapSummary('example.test')).resolves.toBeNull();
    fetchMock
      .mockResolvedValueOnce(bootstrap())
      .mockResolvedValueOnce(
        Response.json({ ...domain, ldhName: 'other.com' }),
      );
    await expect(getRdapSummary('example.com')).rejects.toThrow(
      'different domain',
    );
  });
  it('cancels a stalled body under the shared bootstrap/registry budget', async () => {
    vi.useFakeTimers();
    let signal!: AbortSignal;
    fetchMock.mockImplementation(async (_url, options) => {
      signal = options!.signal as AbortSignal;
      return {
        ok: true,
        json: () =>
          new Promise((_, reject) =>
            signal.addEventListener('abort', () => reject(signal.reason), {
              once: true,
            }),
          ),
      } as Response;
    });
    const pending = expect(getRdapSummary('example.com')).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(4_000);
    await pending;
    expect(signal.aborted).toBe(true);
  });
});
