import { ShareIcon } from 'lucide-react';
import type { Metadata } from 'next';
import type { FC } from 'react';

import { Button } from '@/components/ui/button';

import { generateCsv } from '@/lib/csv';
import { recordLookupAfter } from '@/lib/search';
import { findSubdomains } from '@/lib/subdomains';
import { getSourceLabel } from '@/lib/subfinder-sources';

import { SubdomainsTable } from './_components/table';

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
    title: `Subdomain Search for ${domain}`,
    openGraph: {
      title: `Subdomain Search for ${domain}`,
      url: `/lookup/${domain}/subdomains`,
    },
    alternates: {
      canonical: `/lookup/${domain}/subdomains`,
    },
  };
};

export const maxDuration = 60;

const SubdomainsResultsPage: FC<SubdomainsResultsPageProps> = async ({
  params,
}) => {
  const { domain } = await params;

  const { results, discoveryIncomplete, detailsReduced, detailedResultsLimit } =
    await findSubdomains(domain);

  await recordLookupAfter(domain, 'subdomains', results.length > 0);

  const exportFileName = `Domain Digger Subdomains Export ${domain.replaceAll(
    '.',
    '_',
  )}.csv`;
  const csv = generateCsv(
    results.map((r) => ({
      Domain: r.domain,
      'Found on': r.sources.map(getSourceLabel).join('|'),
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
      <p className="mt-8 text-center text-zinc-500 dark:text-zinc-400">
        {discoveryIncomplete
          ? 'Subdomain discovery timed out before finding any results. Please try again.'
          : 'Could not find any subdomains for this domain.'}
      </p>
    );
  }

  return (
    <>
      <div className="my-12 flex items-center justify-end">
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
            <ShareIcon className="mr-2 size-4" /> Export
          </a>
        </Button>
      </div>

      <SubdomainsTable
        results={results}
        detailedResultsLimit={detailedResultsLimit}
      />

      <p className="mt-8 text-center text-zinc-500 dark:text-zinc-400">
        Found {results.length} subdomains.
        {discoveryIncomplete &&
          ' Discovery timed out; these results are incomplete.'}
        {detailsReduced &&
          ' Some DNS checks could not be completed; their status is unknown.'}
      </p>
    </>
  );
};

export default SubdomainsResultsPage;
