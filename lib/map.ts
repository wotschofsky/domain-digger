import { REGIONS } from '@/lib/data';
import { InternalDoHResolver } from '@/lib/resolvers/internal';

export const getGlobalLookupResults = (domain: string) =>
  Promise.all(
    Object.entries(REGIONS).map(async ([code, data]) => {
      const resolver = new InternalDoHResolver(code, 'cloudflare');
      // TODO Optimize this to only required records
      const results = await resolver.resolveAllRecords(domain);

      return {
        ...data,
        code,
        results: {
          A: results.A.map((r) => r.data),
          AAAA: results.AAAA.map((r) => r.data),
          CNAME: results.CNAME.map((r) => r.data),
        },
      };
    })
  );

export const getHasDifferences = (
  markers: { A: string[]; AAAA: string[]; CNAME: string[] }[]
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
