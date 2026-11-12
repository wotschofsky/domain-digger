import type { Metadata } from 'next';

export const getPageMetadata = (url: string, title?: string): Metadata => {
  // A title key, even undefined, replaces the root layout's title
  const titles = title ? { title } : {};
  return {
    ...titles,
    openGraph: { ...titles, url },
    alternates: { canonical: url },
  };
};
