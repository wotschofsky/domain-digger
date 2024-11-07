import Image from 'next/image';
import { type FC, type HTMLAttributes } from 'react';

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
      <h2 className="text-center font-semibold sm:text-lg">Sponsored by</h2>

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
      <span className="text-center text-sm">
        <a
          className="text-muted-foreground underline decoration-dotted underline-offset-4"
          href="https://github.com/sponsors/wotschofsky"
          target="_blank"
        >
          Sponsor through GitHub and add your logo
        </a>{' '}
        or{' '}
        <a
          className="text-muted-foreground underline decoration-dotted underline-offset-4"
          href="https://wotschofsky.com#contact"
          target="_blank"
        >
          reach out for more options
        </a>
      </span>
    </section>
  );
};
