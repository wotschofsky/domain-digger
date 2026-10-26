'use client';

import { ExternalLinkIcon } from 'lucide-react';
import { useParams } from 'next/navigation';
import type { FC } from 'react';

import { isWildcardDomain } from '@/lib/utils';

import { DomainSummary } from './domain-summary';
import { RelatedDomains } from './related-domains';
import { ResultsTabs } from './results-tabs';
import { ShareButton } from './share-button';

// Reads the domain from the URL, so a client navigation renders it right away
// instead of waiting for the server
export const LookupHeader: FC = () => {
  const { domain } = useParams<{ domain?: string }>();

  // A lookup page hidden by Activity re-renders with the URL it was left
  // for, which may be a landing page without a domain
  if (!domain) return null;

  return (
    <>
      <div className="container space-y-6 pt-12 pb-8">
        <div className="flex w-full items-center gap-4">
          {/* Bottom padding added to avoid clipping */}
          <h1 className="mb-2 flex-1 overflow-hidden pb-1 break-words">
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
        <DomainSummary domain={domain} />
      </div>

      <div className="container">
        <ResultsTabs domain={domain} />
      </div>
    </>
  );
};
