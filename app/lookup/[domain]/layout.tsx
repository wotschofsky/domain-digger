import { ExternalLinkIcon } from 'lucide-react';
import type { Metadata } from 'next';
import type { FC, ReactNode } from 'react';

import ExternalFavicon from '@/components/ExternalFavicon';
import RelatedDomains from '@/components/RelatedDomains';
import ResultsTabs from '@/components/ResultsTabs';
import SearchForm from '@/components/SearchForm';

type LookupLayoutProps = {
  children: ReactNode;
  params: {
    domain: string;
  };
};

export const generateMetadata = ({
  params: { domain },
}: LookupLayoutProps): Metadata => ({
  metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : null,
  title: `Results for ${domain} - digga`,
  openGraph: {
    type: 'website',
    title: `Results for ${domain} - digga`,
    description: `Find DNS records, WHOIS data, SSL/TLS certificate history and more for ${domain}`,
    url: `/lookup/${domain}`,
  },
  alternates: {
    canonical: `/lookup/${domain}`,
  },
});

const LookupLayout: FC<LookupLayoutProps> = ({
  children,
  params: { domain },
}) => {
  let isStandalone = false;

  return (
    <>
      <div
        className={`container mb-8 max-w-xl ${isStandalone ? 'hidden' : null}`}
      >
        <SearchForm initialValue={domain} autofocus={false} />
      </div>

      <div className="container">
        <h1 className="mb-2">
          <span className="block text-muted-foreground">Results for</span>
          <span className="flex flex-row gap-2">
            <ExternalFavicon url={domain} />
            <a
              className="block text-4xl font-bold"
              href={`https://${domain}`}
              target="_blank"
              rel="noreferrer"
            >
              {domain} <ExternalLinkIcon className="inline-block" />
            </a>
          </span>
        </h1>

        <RelatedDomains domain={domain} />
        <ResultsTabs domain={domain} />

        {children}
      </div>
    </>
  );
};

export default LookupLayout;
