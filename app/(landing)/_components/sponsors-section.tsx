import Image from 'next/image';
import { type FC, type HTMLAttributes } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import { env } from '@/env';
import { getGitHubSponsors } from '@/lib/github';
import { cn } from '@/lib/utils';

type SponsorsSectionProps = HTMLAttributes<HTMLElement>;

export const SponsorsSection: FC<SponsorsSectionProps> = async ({
  className,
  ...props
}) => {
  const buildSponsorUrl = (baseUrl: string) => {
    const url = new URL(baseUrl);
    url.searchParams.set('ref', 'domain-digger');
    return url.toString();
  };

  const githubSponsors = await getGitHubSponsors('wotschofsky');

  const allSponsors = [
    ...(env.SPONSORS || []),
    ...githubSponsors.map((s) => ({
      id: s.login,
      name: s.name,
      logoUrl: s.avatarUrl,
      url: s.websiteUrl || s.url,
    })),
  ];

  if (!allSponsors.length) {
    return null;
  }

  return (
    <section
      className={cn(className, 'flex flex-col items-center gap-4')}
      {...props}
    >
      <h2 className="text-center font-semibold">Sponsored by</h2>

      <div className="mb-2 flex items-center justify-center gap-4">
        {allSponsors.map((sponsor) => (
          <a
            key={sponsor.id}
            href={buildSponsorUrl(sponsor.url)}
            target="_blank"
          >
            <Image
              width={48}
              height={48}
              className="h-16 w-16 rounded-md"
              src={sponsor.logoUrl}
              alt={sponsor.name}
            />
          </a>
        ))}
      </div>
      <Dialog>
        <DialogTrigger className="text-center text-sm text-zinc-500 underline decoration-dotted underline-offset-4 dark:text-zinc-400">
          Add your logo
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sponsor Domain Digger</DialogTitle>
          </DialogHeader>
          <p className="text-zinc-500 dark:text-zinc-400">
            Sponsorships help support the project&apos;s development. Your logo
            and link will be featured on all landing pages and the README on
            GitHub.
            <br />
            <br />
            Support through{' '}
            <a
              className="text-zinc-500 underline decoration-dotted underline-offset-4 dark:text-zinc-400"
              href="https://github.com/sponsors/wotschofsky"
              target="_blank"
            >
              GitHub Sponsors
            </a>{' '}
            or{' '}
            <a
              className="text-zinc-500 underline decoration-dotted underline-offset-4 dark:text-zinc-400"
              href="https://buymeacoffee.com/wotschofsky"
              target="_blank"
            >
              Buy Me a Coffee
            </a>
            , or{' '}
            <a
              className="text-zinc-500 underline decoration-dotted underline-offset-4 dark:text-zinc-400"
              href="https://wotschofsky.com#contact"
              target="_blank"
            >
              reach out
            </a>{' '}
            for other options.
          </p>
        </DialogContent>
      </Dialog>
    </section>
  );
};
