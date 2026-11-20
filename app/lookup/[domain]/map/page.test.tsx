// @vitest-environment node
import { log } from 'evlog';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RecordType } from '@/lib/resolvers/base';

import MapResultsPage from './page';

// The record types each region fails to resolve, keyed by region code.
const failing = vi.hoisted(() => new Map<string, RecordType[]>());

vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    }),
}));

vi.mock('./_components/results-globe', () => ({ ResultsGlobe: () => null }));

// Lookup analytics needs the server env and request scope.
vi.mock('@/lib/search', () => ({ recordLookupAfter: async () => {} }));

vi.mock('@/lib/resolvers/internal', async () => {
  const { DnsResolver } = await import('@/lib/resolvers/base');
  const { UserFacingError } = await import('@/lib/user-facing-error');
  const { INCOMPLETE_LOOKUP_ERROR } = await import('@/lib/resolvers/base-doh');

  // Every region answers the same records, except for its failing types.
  class InternalDoHResolver extends DnsResolver {
    constructor(private readonly location: string) {
      super();
    }

    public async resolveRecordType(domain: string, type: RecordType) {
      if (failing.get(this.location)?.includes(type)) {
        throw new UserFacingError(INCOMPLETE_LOOKUP_ERROR);
      }
      return {
        records: [{ name: domain, type, TTL: 300, data: `${type} data` }],
        trace: [],
      };
    }
  }

  return { InternalDoHResolver };
});

const renderPage = async () =>
  renderToStaticMarkup(
    await MapResultsPage({
      params: Promise.resolve({ domain: 'example.com' }),
    }),
  );

describe('map results page', () => {
  beforeEach(() => {
    vi.spyOn(log, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    failing.clear();
    vi.restoreAllMocks();
  });

  it('confirms propagation when every region answered alike', async () => {
    expect(await renderPage()).toContain('All records are the same!');
  });

  it.each<[string, RecordType[]]>([
    ['a whole region failed', ['A', 'AAAA', 'CNAME']],
    ['one type failed in one region', ['A']],
  ])('does not confirm propagation when %s', async (_, types) => {
    failing.set('fra', types);

    const html = await renderPage();

    expect(html).not.toContain('All records are the same');
    expect(html).not.toContain('propagation was successful');
    expect(html).toContain('Some lookups failed');
  });
});
