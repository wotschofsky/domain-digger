'use client';

import Link from 'next/link';
import { useSearchParams, useSelectedLayoutSegment } from 'next/navigation';
import type { FC } from 'react';

import { Button } from '@/components/ui/button';

import {
  findLookupFeatureBySegment,
  getResultsHref,
  withResolverParams,
} from '@/lib/lookup-features';
import { isWildcardDomain } from '@/lib/utils';

type RelatedDomainsProps = {
  domain: string;
};

const getRecommendations = (original: string) => {
  const domains = [];

  const splitOriginal = original.split('.');
  for (let i = 0; i < splitOriginal.length; i++) {
    const domain = splitOriginal.slice(i).join('.');
    if (domain === original) continue;
    domains.push(domain);
  }

  if (
    !original.startsWith('www.') &&
    !isWildcardDomain(original) &&
    splitOriginal.length >= 2
  ) {
    domains.unshift(`www.${original}`);
  }

  return domains;
};

export const RelatedDomains: FC<RelatedDomainsProps> = ({
  domain: original,
}) => {
  const domains = getRecommendations(original);

  // Stay on the current tab and keep its resolver selection
  const selectedSegment = useSelectedLayoutSegment();
  const searchParams = useSearchParams();
  const feature = findLookupFeatureBySegment(selectedSegment)?.id ?? 'dns';

  return (
    <div className="flex flex-wrap gap-4">
      {domains.map((domain) => (
        <Button
          key={domain}
          asChild
          variant="secondary"
          className="h-6 p-2 text-xs whitespace-nowrap"
          aria-label={`Results for ${domain}`}
        >
          <Link
            href={withResolverParams(
              getResultsHref(feature, domain),
              searchParams.toString(),
            )}
          >
            {domain}
          </Link>
        </Button>
      ))}
    </div>
  );
};
