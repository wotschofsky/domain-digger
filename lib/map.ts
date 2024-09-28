import { REGIONS } from '@/lib/data';
import type { DnsResolver } from '@/lib/resolvers/base';

const DISPLAYED_RECORD_TYPES = ['A', 'AAAA', 'CNAME'] as const;

export const getGlobalLookupResults = (
  domain: string,
  resolverFactory: (regionCode: string) => DnsResolver,
) =>
  Promise.all(
    Object.entries(REGIONS).map(async ([code, data]) => {
      const resolver = resolverFactory(code);
      const results = await resolver.resolveRecordTypes(
        domain,
        DISPLAYED_RECORD_TYPES,
      );

      return {
        ...data,
        code,
        results: {
          A: results.A.records.map((r) => r.data),
          AAAA: results.AAAA.records.map((r) => r.data),
          CNAME: results.CNAME.records.map((r) => r.data),
        },
      };
    }),
  );

export const getHasDifferences = (
  markers: { A: string[]; AAAA: string[]; CNAME: string[] }[],
) => {
  let hasDifferentRecords = false;
  for (let i = 1; i < markers.length; i++) {
    const previous = markers[i - 1];
    const current = markers[i];
    if (
      previous.A.toSorted().toString() !== current.A.toSorted().toString() ||
      previous.AAAA.toSorted().toString() !==
        current.AAAA.toSorted().toString() ||
      previous.CNAME.toSorted().toString() !==
        current.CNAME.toSorted().toString()
    ) {
      hasDifferentRecords = true;
      break;
    }
  }
  return hasDifferentRecords;
};
