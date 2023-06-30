import { ExternalLinkIcon } from 'lucide-react';
import type { FC, ReactNode } from 'react';

import RelatedDomains from '@/components/RelatedDomains';
import ResultsTabs from '@/components/ResultsTabs';
import SearchForm from '@/components/SearchForm';

type LookupLayoutProps = {
  children: ReactNode;
  params: {
    domain: string;
  };
};

const LookupLayout: FC<LookupLayoutProps> = ({
  children,
  params: { domain },
}) => {
  let isStandalone = false;

  return (
    <>
      <title>{`Results for ${domain} - Domain Digger`}</title>

      <div
        className={`container mb-8 max-w-xl ${isStandalone ? 'hidden' : null}`}
      >
        <SearchForm initialValue={domain} autofocus={false} />
      </div>

      <div className="container">
        <h1 className="mb-2 text-4xl font-bold">
          Results for{' '}
          <a
            href={`https://${domain}`}
            target="_blank"
            className="font-extrabold underline-offset-2 hover:underline"
            rel="noreferrer"
          >
            {domain} <ExternalLinkIcon className="inline-block no-underline" />
          </a>
        </h1>

        <RelatedDomains domain={domain} />
        <ResultsTabs domain={domain} />

        {children}
      </div>
    </>
  );
};

export default LookupLayout;
