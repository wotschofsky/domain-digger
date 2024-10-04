import { lookupCerts } from './certs';
import type { DnsResolver } from './resolvers/base';
import { deduplicate, isValidDomain } from './utils';

const DETAILED_RESULTS_LIMIT = 500;

export const findSubdomains = async (domain: string, resolver: DnsResolver) => {
  const certs = await lookupCerts(domain);

  const issuedCerts = certs.map((cert) => ({
    date: new Date(cert.entry_timestamp),
    domains: [cert.common_name, ...cert.name_value.split(/\n/g)],
  }));

  const uniqueDomains = deduplicate(issuedCerts.flatMap((r) => r.domains))
    .filter(isValidDomain)
    .filter((d) => d.endsWith(`.${domain}`));

  const results = await Promise.all(
    uniqueDomains
      .map((domain) => ({
        domain,
        firstSeen: issuedCerts
          .filter((c) => c.domains.includes(domain))
          .toSorted((a, b) => a.date.getTime() - b.date.getTime())[0].date,
      }))
      .toSorted((a, b) => b.firstSeen.getTime() - a.firstSeen.getTime())
      .map(async (entry, index) => {
        // Limited to avoid subrequest limit from Cloudflare Workers of 1000
        // https://developers.cloudflare.com/workers/platform/limits#subrequests
        if (index > DETAILED_RESULTS_LIMIT) {
          return {
            ...entry,
            stillExists: null,
          };
        }

        const records = await resolver.resolveRecordType(entry.domain, 'A');
        const hasRecords = records.records.length > 0;

        return {
          ...entry,
          stillExists: hasRecords,
        };
      }),
  );

  const sortedResults = results.toSorted(
    (a, b) => b.firstSeen.getTime() - a.firstSeen.getTime(),
  );

  return {
    results: sortedResults,
    detailsReduced: uniqueDomains.length > DETAILED_RESULTS_LIMIT,
    detailedResultsLimit: DETAILED_RESULTS_LIMIT,
  };
};
