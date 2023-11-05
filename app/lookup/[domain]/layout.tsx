import { ExternalLinkIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { type FC, type ReactNode, Suspense } from 'react';

import RelatedDomains from '@/components/RelatedDomains';
import ResultsTabs from '@/components/ResultsTabs';
import SearchForm from '@/components/SearchForm';
import WhoisQuickInfo, {
  WhoisQuickInfoPlaceholder,
} from '@/components/WhoisQuickInfo';

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
  title: `Results for ${domain} - Domain Digger`,
  description: `Find DNS records, WHOIS data, SSL/TLS certificate history and other for ${domain}`,
  openGraph: {
    type: 'website',
    title: `Results for ${domain} - Domain Digger`,
    description: `Find DNS records, WHOIS data, SSL/TLS certificate history and other for ${domain}`,
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
  return (
    <>
      <div className="container mb-8 max-w-xl">
        <SearchForm initialValue={domain} autofocus={false} />
      </div>

      <div className="container">
        <h1 className="mb-2">
          <span className="block text-muted-foreground">Results for</span>
          <a
            className="block text-4xl font-bold"
            href={`https://${domain}`}
            target="_blank"
            rel="noreferrer"
          >
            {domain} <ExternalLinkIcon className="inline-block" />
          </a>
        </h1>

        <RelatedDomains domain={domain} />
        <Suspense fallback={<WhoisQuickInfoPlaceholder />}>
          {/* TODO Add error boundary */}
          <WhoisQuickInfo domain={domain} />
        </Suspense>
        <ResultsTabs domain={domain} />

        {children}
      </div>
    </>
  );
};

export default LookupLayout;
