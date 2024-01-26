import type { Metadata } from 'next';
import { type FC, Fragment } from 'react';
import whoiser, { type WhoisSearchResult } from 'whoiser';

const lookupWhois = async (domain: string) => {
  const result = await whoiser(domain, {
    raw: true,
    timeout: 5000,
  });

  const mappedResults: Record<string, string> = {};
  for (const key in result) {
    mappedResults[key] = (result[key] as WhoisSearchResult).__raw as string;
  }

  return mappedResults;
};

type WhoisResultsPageProps = {
  params: {
    domain: string;
  };
};

export const generateMetadata = ({
  params: { domain },
}: WhoisResultsPageProps): Metadata => ({
  openGraph: {
    url: `/lookup/${domain}/whois`,
  },
  alternates: {
    canonical: `/lookup/${domain}/whois`,
  },
});

const WhoisResultsPage: FC<WhoisResultsPageProps> = async ({
  params: { domain },
}) => {
  const results = await lookupWhois(domain);
  const filteredResults = Object.entries(results).filter(([_key, value]) =>
    Boolean(value)
  );

  if (filteredResults.length === 0) {
    throw new Error('No results found');
  }

  return (
    <>
      {filteredResults.map(([key, value]) => (
        <Fragment key={key}>
          <h2 className="mb-4 mt-8 text-3xl font-bold tracking-tight">{key}</h2>
          <code className="break-words">
            {value.split('\n').map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </code>
        </Fragment>
      ))}
    </>
  );
};

export default WhoisResultsPage;
