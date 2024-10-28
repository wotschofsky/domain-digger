import { ShareIcon } from 'lucide-react';
import type { Metadata } from 'next';
import type { FC } from 'react';

import { Button } from '@/components/ui/button';

import { generateCsv } from '@/lib/csv';
import { CloudflareDoHResolver } from '@/lib/resolvers/cloudflare';
import { findSubdomains } from '@/lib/subdomains';

import { SubdomainsInfoAlert } from './_components/info-alert';
import { SubdomainsTable } from './_components/table';

export const runtime = 'edge';
// crt.sh located in GB, always use LHR1 for lowest latency
export const preferredRegion = 'lhr1';

type SubdomainsResultsPageProps = {
  params: Promise<{
    domain: string;
  }>;
};

export const generateMetadata = async ({
  params,
}: SubdomainsResultsPageProps): Promise<Metadata> => {
  const { domain } = await params;

  return {
    openGraph: {
      url: `/lookup/${domain}/subdomains`,
    },

    alternates: {
      canonical: `/lookup/${domain}/subdomains`,
    },
  };
};

const SubdomainsResultsPage: FC<SubdomainsResultsPageProps> = async ({
  params,
}) => {
  const { domain } = await params;

  const { results, detailsReduced, detailedResultsLimit } =
    await findSubdomains(domain, new CloudflareDoHResolver());

  const exportFileName = `Domain Digger Subdomains Export ${domain.replaceAll(
    '.',
    '_',
  )}.csv`;
  const csv = generateCsv(
    results
      .toSorted((a, b) => b.firstSeen.getTime() - a.firstSeen.getTime())
      .map((r) => ({
        Domain: r.domain,
        'First seen': r.firstSeen.toISOString(),
        'Still exists':
          r.stillExists === true
            ? 'yes'
            : r.stillExists === false
              ? 'no'
              : 'unknown',
      })),
  );
  const encodedCsv = encodeURIComponent(csv);

  if (!results.length) {
    return (
      <p className="mt-8 text-center text-muted-foreground">
        Could not find any subdomains for this domain.
      </p>
    );
  }

  return (
    <>
      <div className="my-12 flex items-center justify-between">
        <SubdomainsInfoAlert domain={domain} />
        <Button
          className={[
            `plausible-event-name=Export`,
            `plausible-event-type=Subdomains`,
            `plausible-event-domain=${domain}`,
          ].join(' ')}
          variant="outline"
          disabled={!results.length}
          asChild
        >
          <a
            href={`data:text/csv;charset=utf-8,${encodedCsv}`}
            download={exportFileName}
          >
            <ShareIcon className="mr-2 h-4 w-4" /> Export
          </a>
        </Button>
      </div>

      <SubdomainsTable
        results={results}
        detailedResultsLimit={detailedResultsLimit}
      />

      <p className="mt-8 text-center text-muted-foreground">
        Found {results.length} subdomains.
        {detailsReduced &&
          ` Detailed results limited to ${detailedResultsLimit} subdomains. Some entries may lack information.`}
      </p>
    </>
  );
};

export default SubdomainsResultsPage;
