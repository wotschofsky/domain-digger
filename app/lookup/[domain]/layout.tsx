import { ExternalLinkIcon } from 'lucide-react';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { type FC, type ReactNode } from 'react';

import SearchForm from '@/components/general/SearchForm';
import RelatedDomains from '@/components/results/RelatedDomains';
import ResultsTabs from '@/components/results/ResultsTabs';
import ShareButton from '@/components/results/ShareButton';
import WhoisQuickInfo from '@/components/results/WhoisQuickInfo';
import { isValidDomain } from '@/lib/utils';

const StarReminder = dynamic(
  () => import('@/components/results/StarReminder'),
  { ssr: false }
);

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
  description: `Find DNS records, WHOIS data, SSL/TLS certificate history and other for ${domain} using Domain Digger, the full open-source toolkit for next-level domain analysis.`,
  openGraph: {
    type: 'website',
    title: `Results for ${domain} - Domain Digger`,
    description: `Find DNS records, WHOIS data, SSL/TLS certificate history and other for ${domain} using Domain Digger, the full open-source toolkit for next-level domain analysis.`,
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
        <div className="flex w-full items-center gap-4">
          <h1 className="mb-2 flex-1 overflow-hidden break-words">
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

      <StarReminder />
    </>
  );
};

export default LookupLayout;
