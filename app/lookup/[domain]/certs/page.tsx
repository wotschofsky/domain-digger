import type { Metadata } from 'next';
import type { FC } from 'react';

import { lookupRelatedCerts } from '@/lib/certs';

import { CertsTable } from './_components/table';

export const runtime = 'edge';
// crt.sh located in GB, always use LHR1 for lowest latency
export const preferredRegion = 'lhr1';

type CertsResultsPageProps = {
  params: Promise<{
    domain: string;
  }>;
};

export const generateMetadata = async ({
  params,
}: CertsResultsPageProps): Promise<Metadata> => {
  const { domain } = await params;

  return {
    openGraph: {
      url: `/lookup/${domain}/certs`,
    },

    alternates: {
      canonical: `/lookup/${domain}/certs`,
    },
  };
};

const CertsResultsPage: FC<CertsResultsPageProps> = async (props) => {
  const params = await props.params;

  const { domain } = params;

  const certs = await lookupRelatedCerts(domain);

  if (!certs.length) {
    return (
      <p className="mt-8 text-center text-muted-foreground">
        No issued certificates found!
      </p>
    );
  }

  return <CertsTable certs={certs} />;
};

export default CertsResultsPage;
