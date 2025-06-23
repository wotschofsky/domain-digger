import { ExternalLinkIcon, TrendingUpIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const TARGET_URL =
  'https://digest.guru/?utm_source=domain-digger&utm_medium=banner&utm_campaign=dns-lookup';

export const DigestGuruBanner = () => (
  <Card className="bg-zinc-100 p-6 dark:bg-zinc-950">
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-1 items-start gap-4">
        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 dark:bg-white">
          <TrendingUpIcon className="h-4 w-4 text-white dark:text-zinc-950" />
        </div>
        <div className="flex-1">
          <h3 className="mb-2 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Busy professional? Stay ahead of the curve!
          </h3>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Get personalized email summaries from your favorite thought leaders
            on YouTube & X.
          </p>
          <p className="mb-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Stay up-to-date while{' '}
            <a className="font-bold" href={TARGET_URL} target="_blank">
              saving hours of scrolling
            </a>{' '}
            — perfect for busy professionals who need to stay informed.
          </p>
          <Button asChild size="sm">
            <a href={TARGET_URL} target="_blank" rel="noopener noreferrer">
              Get Your Digest
              <ExternalLinkIcon className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  </Card>
);
