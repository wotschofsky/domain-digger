'use client';

import Link from 'next/link';
import type { FC } from 'react';

import { Button } from '@/components/ui/button';

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

  return (
    <div className="my-4 flex flex-wrap gap-4">
      {domains.map((domain) => (
        <Button
          key={domain}
          asChild
          variant="secondary"
          className="h-6 whitespace-nowrap p-2 text-xs"
          aria-label={`Results for ${domain}`}
        >
          <Link href={`/lookup/${domain}`}>{domain}</Link>
        </Button>
      ))}
    </div>
  );
};
