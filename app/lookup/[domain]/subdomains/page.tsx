import type { Metadata } from 'next';
import type { FC } from 'react';

import { CloudflareDoHResolver } from '@/lib/resolvers/cloudflare';
import { findSubdomains } from '@/lib/subdomains';

import { SubdomainsTable } from './_components/table';

export const runtime = 'edge';
// crt.sh located in GB, always use LHR1 for lowest latency
export const preferredRegion = 'lhr1';

type SubdomainsResultsPageProps = {
  params: {
    domain: string;
  };
};

export const generateMetadata = ({
  params: { domain },
}: SubdomainsResultsPageProps): Metadata => ({
  openGraph: {
    url: `/lookup/${domain}/subdomains`,
  },
  alternates: {
    canonical: `/lookup/${domain}/subdomains`,
  },
});

const SubdomainsResultsPage: FC<SubdomainsResultsPageProps> = async ({
  params: { domain },
}) => {
  const { results, isTruncated, RESULTS_LIMIT } = await findSubdomains(
    domain,
    new CloudflareDoHResolver()
  );

  if (!results.length) {
    return (
      <p className="mt-8 text-center text-muted-foreground">
        Could not find any subdomains for this domain.
      </p>
    );
  }

  return (
    <>
      <SubdomainsTable results={results} />

      {isTruncated && (
        <p className="mt-8 text-center text-muted-foreground">
          Results limited to {RESULTS_LIMIT} subdomains.
        </p>
      )}
    </>
  );
};

export default SubdomainsResultsPage;
