import { waitUntil } from '@vercel/functions';
import { ExternalLinkIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { type FC, type ReactNode } from 'react';

import { getVisitorIp, isUserBot } from '@/lib/api';
import { recordLookup } from '@/lib/search';
import { isValidDomain, isWildcardDomain } from '@/lib/utils';

import { SearchForm } from '../../_components/search-form';
import { RelatedDomains } from './_components/related-domains';
import { ResultsTabs } from './_components/results-tabs';
import { ShareButton } from './_components/share-button';
import { WhoisQuickInfo } from './_components/whois-quick-info';

type LookupLayoutProps = {
  children: ReactNode;
  params: Promise<{
    domain: string;
  }>;
};

export const generateMetadata = async ({
  params,
}: LookupLayoutProps): Promise<Metadata> => {
  const { domain } = await params;

  return {
    title: `Results for ${domain} - Domain Digger`,
    description: `Find DNS records, WHOIS data, SSL/TLS certificate history and other for ${domain} using Domain Digger, the full open-source toolkit for next-level domain analysis.`,

    openGraph: {
      type: 'website',
      title: `Results for ${domain} - Domain Digger`,
      description: `Find DNS records, WHOIS data, SSL/TLS certificate history and other for ${domain} using Domain Digger, the full open-source toolkit for next-level domain analysis.`,
    },
  };
};

const LookupLayout: FC<LookupLayoutProps> = async (props) => {
  const params = await props.params;

  const { domain } = params;

  const { children } = props;

  if (!isValidDomain(domain)) {
    return notFound();
  }

  const headersList = await headers();
  const ip = getVisitorIp(headersList);
  const { isBot, userAgent } = isUserBot(headersList);
  waitUntil(recordLookup({ domain, ip, userAgent, isBot }));

  return (
    <>
      <div className="container mb-12 max-w-2xl">
        <SearchForm initialValue={domain} autofocus={false} />
      </div>

      <div className="container">
        <div className="flex w-full items-center gap-4">
          {/* Bottom padding added to avoid clipping */}
          <h1 className="mb-2 flex-1 overflow-hidden break-words pb-1">
            <span className="block text-muted-foreground">Results for</span>
            {isWildcardDomain(domain) ? (
              <span className="block text-4xl font-bold">{domain}</span>
            ) : (
              <a
                className="block text-4xl font-bold"
                href={`https://${domain}`}
                target="_blank"
                rel="noreferrer nofollow"
              >
                {domain} <ExternalLinkIcon className="inline-block" />
              </a>
            )}
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
