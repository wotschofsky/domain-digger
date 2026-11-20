import { log } from 'evlog';

import { REGIONS } from '@/lib/data';
import type { DnsResolver } from '@/lib/resolvers/base';
import { UserFacingError } from '@/lib/user-facing-error';
import { serializeError } from '@/lib/utils';

const DISPLAYED_RECORD_TYPES = ['A', 'AAAA', 'CNAME'] as const;

// null marks a failed lookup: unknown, not a confirmed empty RRset.
export type MapLookupResults = Record<
  (typeof DISPLAYED_RECORD_TYPES)[number],
  string[] | null
>;

const FAILED_RESULTS: MapLookupResults = { A: null, AAAA: null, CNAME: null };

// One region's failure only marks that region; throws if every region failed.
export const getGlobalLookupResults = async (
  domain: string,
  resolverFactory: (regionCode: string) => DnsResolver,
) => {
  const regions = Object.entries(REGIONS);
  const settled = await Promise.allSettled(
    regions.map(([code]) =>
      resolverFactory(code).resolveRecordTypes(domain, DISPLAYED_RECORD_TYPES),
    ),
  );
  const failures = settled.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failures.length === settled.length) throw failures[0].reason;

  return regions.map(([code, data], index) => {
    const result = settled[index];
    if (result.status === 'rejected') {
      log[result.reason instanceof UserFacingError ? 'warn' : 'error']({
        message: 'map_region_lookup_failed',
        domain,
        region: code,
        error: serializeError(result.reason),
      });
      return { ...data, code, results: FAILED_RESULTS };
    }
    const records = (type: (typeof DISPLAYED_RECORD_TYPES)[number]) =>
      result.value[type].error
        ? null
        : result.value[type].records.map((r) => r.data);
    return {
      ...data,
      code,
      results: {
        A: records('A'),
        AAAA: records('AAAA'),
        CNAME: records('CNAME'),
      },
    };
  });
};

// Failed lookups are unknown, so they never count as a difference.
export const getHasDifferences = (markers: MapLookupResults[]) =>
  DISPLAYED_RECORD_TYPES.some(
    (type) =>
      new Set(
        markers.flatMap((marker) => {
          const values = marker[type];
          return values ? [values.toSorted().toString()] : [];
        }),
      ).size > 1,
  );
