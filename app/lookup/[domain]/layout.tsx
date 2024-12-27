import { waitUntil } from '@vercel/functions';
import { ExternalLinkIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { type FC, type ReactNode } from 'react';

import { Card } from '@/components/ui/card';

import { getVisitorIp, isUserBot } from '@/lib/api';
import { recordLookup } from '@/lib/search';
import { isValidDomain, isWildcardDomain } from '@/lib/utils';

import { Footer } from '../../_components/footer';
import { Header } from '../../_components/header';
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
    description: `Find DNS records, WHOIS data, SSL/TLS certificate history and other for ${domain} using Domain Digger, the full open-source toolkit for next-level domain analysis.`,
    openGraph: {
      type: 'website',
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
      <Header showSearch={true} />
      <main className="flex w-full flex-1 flex-col">
        <div className="container space-y-6 pb-8 pt-12">
          <div className="flex w-full items-center gap-4">
            {/* Bottom padding added to avoid clipping */}
            <h1 className="mb-2 flex-1 overflow-hidden break-words pb-1">
              <span className="block text-zinc-500 dark:text-zinc-400">
                Results for
              </span>
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
        </div>

        <div className="container">
          <ResultsTabs domain={domain} />
        </div>

        <div className="flex flex-1 flex-col p-3">
          <Card className="flex-1 py-8">
            <div className="container px-5 min-[1400px]:max-w-[calc(1400px-2*.75rem)]">
              {children}
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default LookupLayout;
