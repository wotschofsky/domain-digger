import type { Metadata } from 'next';
import type { FC } from 'react';

import { lookupRelatedCerts } from '@/lib/certs';
import { getPageMetadata } from '@/lib/page-metadata';
import { recordLookupAfter } from '@/lib/search';

import { CertsTable } from './_components/table';

type CertsResultsPageProps = {
  params: Promise<{
    domain: string;
  }>;
};

export const generateMetadata = async ({
  params,
}: CertsResultsPageProps): Promise<Metadata> => {
  const { domain } = await params;

  return getPageMetadata({
    url: `/lookup/${domain}/certs`,
    title: `Certificate Logs for ${domain}`,
  });
};

const CertsResultsPage: FC<CertsResultsPageProps> = async (props) => {
  const params = await props.params;

  const { domain } = params;

  const certs = await lookupRelatedCerts(domain);

  await recordLookupAfter(domain, 'certs', certs.length > 0);

  if (!certs.length) {
    return (
      <p className="mt-8 text-center text-zinc-500 dark:text-zinc-400">
        No issued certificates found!
      </p>
    );
  }

  return (
    <>
      <CertsTable certs={certs} />

      <p className="mt-8 text-center text-zinc-500 dark:text-zinc-400">
        Found {certs.length} certificates.
      </p>
    </>
  );
};

export default CertsResultsPage;
