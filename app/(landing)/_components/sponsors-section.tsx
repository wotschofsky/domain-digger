import Image from 'next/image';
import { type FC, type HTMLAttributes, useCallback } from 'react';

import { env } from '@/env';
import { getGitHubSponsors } from '@/lib/github';
import { cn } from '@/lib/utils';

type SponsorsSectionProps = HTMLAttributes<HTMLElement>;

export const SponsorsSection: FC<SponsorsSectionProps> = async ({
  className,
  ...props
}) => {
  const buildSponsorUrl = useCallback(
    (sponsor: { url: string; websiteUrl: string | null }) => {
      if (!sponsor.websiteUrl) return sponsor.url;
      const url = new URL(sponsor.websiteUrl);
      url.searchParams.set('ref', 'domain-digger');
      return url.toString();
    },
    []
  );

  if (!env.GITHUB_TOKEN) {
    return null;
  }

  const sponsors = await getGitHubSponsors('wotschofsky');
  const shownSponsors = sponsors.filter((sponsor) => sponsor.amount >= 50);

  if (!shownSponsors.length) {
    return null;
  }

  return (
    <section
      className={cn(className, 'flex flex-col items-center gap-4')}
      {...props}
    >
      <h2 className="text-center font-semibold sm:text-lg">Sponsored by</h2>

      <div className="mb-2 flex items-center justify-center gap-4">
        {shownSponsors.map((sponsor) => (
          <a
            key={sponsor.login}
            href={buildSponsorUrl(sponsor)}
            target="_blank"
          >
            <Image
              width={48}
              height={48}
              className="h-16 w-16 rounded-md"
              src={sponsor.avatarUrl}
              alt={sponsor.name}
            />
          </a>
        ))}
      </div>
      <a
        className="text-center text-sm text-muted-foreground underline decoration-dotted underline-offset-4"
        href="https://github.com/sponsors/wotschofsky"
        target="_blank"
      >
        Sponsor Domain Digger
      </a>
    </section>
  );
};
