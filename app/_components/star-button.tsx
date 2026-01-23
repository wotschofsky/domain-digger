'use client';

import { StarIcon } from 'lucide-react';
import type { FC } from 'react';

import { Button } from '@/components/ui/button';

import { useStargazersSummary } from '../api/stargazers-summary/hook';

export const StarButton: FC = () => {
  const { data } = useStargazersSummary();

  return (
    <Button variant="ghost" asChild className="px-2">
      <a
        href="https://github.com/wotschofsky/domain-digger"
        target="_blank"
        rel="noopener"
      >
        <StarIcon className="mr-1 h-4 w-4 fill-yellow-400 text-yellow-400" />
        <span className="hidden md:inline">
          {data?.totalStars ? data.totalStars.toLocaleString() : 'Star'}
          <span className="sr-only"> on GitHub</span>
        </span>
      </a>
    </Button>
  );
};
