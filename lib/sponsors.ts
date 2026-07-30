import type { RemotePattern } from 'next/dist/shared/lib/image-config';

import { env } from '../env';

import { getGitHubSponsors } from './github';

export const GITHUB_SPONSOR_USERNAME = 'wotschofsky';

export type Sponsor = {
  id: string;
  name: string;
  logoUrl: string;
  url: string;
};

export const buildSponsorUrl = (baseUrl: string) => {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('ref', 'domain-digger');
    return url.toString();
  } catch {
    return `https://${baseUrl}?ref=domain-digger`;
  }
};

export const getAllSponsors = async (): Promise<Sponsor[]> => {
  const githubSponsors = await getGitHubSponsors(GITHUB_SPONSOR_USERNAME);

  return [
    ...(env.SPONSORS ?? []),
    ...githubSponsors.map((s) => ({
      id: s.login,
      name: s.name,
      logoUrl: s.avatarUrl,
      url: s.websiteUrl || s.url,
    })),
  ];
};

export const sponsorLogoUrlsToRemotePatterns = (
  urls: string[],
): RemotePattern[] =>
  urls.map((url) => {
    const { hostname, pathname } = new URL(url);
    return { hostname, pathname };
  });

export const getSponsorImageRemotePatterns = async (): Promise<
  RemotePattern[]
> => sponsorLogoUrlsToRemotePatterns((await getAllSponsors()).map((s) => s.logoUrl));
