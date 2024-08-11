import { lookupCerts } from './certs';
import type { DnsResolver } from './resolvers/base';
import { deduplicate, isValidDomain } from './utils';

const RESULTS_LIMIT = 500;

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
    // Limited to avoid subrequest limit from Cloudflare Workers of 1000
    // https://developers.cloudflare.com/workers/platform/limits#subrequests
    uniqueDomains.slice(0, RESULTS_LIMIT).map(async (domain) => {
      const records = await resolver.resolveRecordType(domain, 'A');
      const hasRecords = records.records.length > 0;

      return {
        domain,
        firstSeen: issuedCerts
          .filter((c) => c.domains.includes(domain))
          .toSorted((a, b) => a.date.getTime() - b.date.getTime())[0].date,
        stillExists: hasRecords,
      };
    })
  );

  const sortedResults = results.toSorted(
    (a, b) => b.firstSeen.getTime() - a.firstSeen.getTime()
  );

  return {
    results: sortedResults,
    isTruncated: uniqueDomains.length > RESULTS_LIMIT,
    RESULTS_LIMIT,
  };
};
