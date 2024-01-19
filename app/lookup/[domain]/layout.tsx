import { ExternalLinkIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { type FC, type ReactNode } from 'react';

import RelatedDomains from '@/components/RelatedDomains';
import ResultsTabs from '@/components/ResultsTabs';
import SearchForm from '@/components/SearchForm';
import ShareButton from '@/components/ShareButton';
import WhoisQuickInfo from '@/components/WhoisQuickInfo';
import { isValidDomain } from '@/lib/utils';

type LookupLayoutProps = {
  children: ReactNode;
  params: {
    domain: string;
  };
};

export const generateMetadata = ({
  params: { domain },
}: LookupLayoutProps): Metadata => ({
  title: `Results for ${domain} - Domain Digger`,
  description: `Find DNS records, WHOIS data, SSL/TLS certificate history and other for ${domain}`,
  openGraph: {
    type: 'website',
    title: `Results for ${domain} - Domain Digger`,
    description: `Find DNS records, WHOIS data, SSL/TLS certificate history and other for ${domain}`,
  },
});

const LookupLayout: FC<LookupLayoutProps> = ({
  children,
  params: { domain },
}) => {
  if (!isValidDomain(domain)) {
    return notFound();
  }

  return (
    <>
      <div className="container mb-8 max-w-xl">
        <SearchForm
          textAlignment="center"
          initialValue={domain}
          autofocus={false}
        />
      </div>

      <div className="container">
        <div className="flex items-center gap-4">
          <h1 className="mb-2 flex-1">
            <span className="block text-muted-foreground">Results for</span>
            <a
              className="block text-4xl font-bold"
              href={`https://${domain}`}
              target="_blank"
              rel="noreferrer nofollow"
            >
              {domain} <ExternalLinkIcon className="inline-block" />
            </a>
          </h1>

          <ShareButton />
        </div>

        <RelatedDomains domain={domain} />
        <WhoisQuickInfo domain={domain} />
        <ResultsTabs domain={domain} />

        {children}
      </div>
    </>
  );
};

export default LookupLayout;
