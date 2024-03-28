import type { Metadata } from 'next';
import Link from 'next/link';
import { type FC, Fragment } from 'react';
import { getDomain } from 'tldts';
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

  const filteredResults = Object.entries(mappedResults).filter(
    ([_key, value]) => Boolean(value)
  );

  return filteredResults;
};

type WhoisResultsPageProps = {
  params: {
    domain: string;
  };
  searchParams: {
    force?: string;
  };
};

export const generateMetadata = ({
  params: { domain },
  searchParams: { force },
}: WhoisResultsPageProps): Metadata => {
  const search = force !== undefined ? '?force' : '';

  return {
    openGraph: {
      url: `/lookup/${domain}/whois${search}`,
    },
    alternates: {
      canonical: `/lookup/${domain}/whois${search}`,
    },
  };
};

const WhoisResultsPage: FC<WhoisResultsPageProps> = async ({
  params: { domain },
  searchParams: { force },
}) => {
  const forceOriginal = force !== undefined;
  const rawDomain = getDomain(domain) || domain;
  const results = await lookupWhois(forceOriginal ? domain : rawDomain);

  if (results.length === 0) {
    throw new Error('No results found');
  }

  return (
    <>
      {rawDomain !== domain &&
        (force !== undefined ? (
          <>
            <p className="mt-8 text-muted-foreground">
              Forcing lookup for {domain}
            </p>
            <p className="text-muted-foreground">
              Lookup{' '}
              <Link
                className="underline decoration-dotted underline-offset-4"
                href={`/lookup/${domain}/whois`}
              >
                {rawDomain} instead
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="mt-8 text-muted-foreground">
              Showing results for {rawDomain}
            </p>
            <p className="text-muted-foreground">
              Force lookup for{' '}
              <Link
                className="underline decoration-dotted underline-offset-4"
                href={`/lookup/${domain}/whois?force`}
              >
                {domain} instead
              </Link>
            </p>
          </>
        ))}

      {results.map(([key, value]) => (
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
