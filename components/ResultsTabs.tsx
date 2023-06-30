'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { FC } from 'react';

type ResultsTabsProps = {
  domain: string;
};

const ResultsTabs: FC<ResultsTabsProps> = ({ domain }) => {
  const selectedSegment = useSelectedLayoutSegment();

  return (
    <div className="mb-6 mt-6 border-b border-gray-200 text-center text-sm font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
      <ul className="-mb-px flex flex-wrap">
        <li className="mr-2">
          <Link
            href={`/lookup/${domain}`}
            className={
              selectedSegment === null
                ? 'inline-block rounded-t-lg border-b-2 border-primary p-4 text-primary'
                : 'inline-block rounded-t-lg border-b-2 border-transparent p-4 hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300'
            }
          >
            Overview
          </Link>
        </li>
        <li className="mr-2">
          <Link
            href={`/lookup/${domain}/dns`}
            className={
              selectedSegment === 'dns'
                ? 'inline-block rounded-t-lg border-b-2 border-primary p-4 text-primary'
                : 'inline-block rounded-t-lg border-b-2 border-transparent p-4 hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300'
            }
            aria-current="page"
          >
            DNS Records
          </Link>
        </li>
        <li className="mr-2">
          <Link
            href={`/lookup/${domain}/whois`}
            className={
              selectedSegment === 'whois'
                ? 'inline-block rounded-t-lg border-b-2 border-primary p-4 text-primary'
                : 'inline-block rounded-t-lg border-b-2 border-transparent p-4 hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300'
            }
            aria-current="page"
          >
            WHOIS
          </Link>
        </li>
        <li className="mr-2">
          <Link
            href={`/lookup/${domain}/certs`}
            className={
              selectedSegment === 'certs'
                ? 'inline-block rounded-t-lg border-b-2 border-primary p-4 text-primary'
                : 'inline-block rounded-t-lg border-b-2 border-transparent p-4 hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300'
            }
            aria-current="page"
          >
            SSL Certs
          </Link>
        </li>
      </ul>
    </div>
  );
};

export default ResultsTabs;
