import type { Metadata } from 'next';

type PageMetadataOptions = {
  url: string;
  // Leave out to keep the root layout's title
  title?: string;
};

export const getPageMetadata = ({
  url,
  title,
}: PageMetadataOptions): Metadata => {
  // A title key, even undefined, replaces the root layout's title
  const titles = title !== undefined ? { title } : {};
  return {
    ...titles,
    openGraph: { ...titles, url },
    alternates: { canonical: url },
  };
};
