'use client';

import { OptionIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSelectedLayoutSegment } from 'next/navigation';
import type { FC } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

type ResultsTabsProps = {
  domain: string;
};

const ResultsTabs: FC<ResultsTabsProps> = ({ domain }) => {
  const router = useRouter();
  const selectedSegment = useSelectedLayoutSegment();

  useHotkeys('alt+1', () => router.push(`/lookup/${domain}`), [router]);
  useHotkeys('alt+2', () => router.push(`/lookup/${domain}/whois`), [router]);
  useHotkeys('alt+3', () => router.push(`/lookup/${domain}/certs`), [router]);

  return (
    <div className="group mb-6 mt-6 border-b border-gray-200 text-center text-sm font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
      <ul className="-mb-px flex flex-wrap">
        <li className="mr-2">
          <Link
            href={`/lookup/${domain}`}
            className={
              selectedSegment === null
                ? 'relative inline-block rounded-t-lg border-b-2 border-primary p-4 text-primary'
                : 'relative inline-block rounded-t-lg border-b-2 border-transparent p-4 hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300'
            }
          >
            DNS
            <div className="pointer-events-none absolute bottom-0 translate-y-4 text-xs text-muted-foreground opacity-0 transition-all group-hover:translate-y-6 group-hover:opacity-100">
              <OptionIcon className="inline-block h-3 w-3" strokeWidth={3} />
              {' + 1'}
            </div>
          </Link>
        </li>
        <li className="mr-2">
          <Link
            href={`/lookup/${domain}/whois`}
            className={
              selectedSegment === 'whois'
                ? 'relative inline-block rounded-t-lg border-b-2 border-primary p-4 text-primary'
                : 'relative inline-block rounded-t-lg border-b-2 border-transparent p-4 hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300'
            }
            aria-current="page"
          >
            Whois
            <div className="pointer-events-none absolute bottom-0 translate-y-4 text-xs text-muted-foreground opacity-0 transition-all group-hover:translate-y-6 group-hover:opacity-100">
              <OptionIcon className="inline-block h-3 w-3" strokeWidth={3} />
              {' + 2'}
            </div>
          </Link>
        </li>
        <li className="mr-2">
          <Link
            href={`/lookup/${domain}/certs`}
            className={
              selectedSegment === 'certs'
                ? 'relative inline-block rounded-t-lg border-b-2 border-primary p-4 text-primary'
                : 'relative inline-block rounded-t-lg border-b-2 border-transparent p-4 hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300'
            }
            aria-current="page"
          >
            Certs
            <div className="pointer-events-none absolute bottom-0 translate-y-4 text-xs text-muted-foreground opacity-0 transition-all group-hover:translate-y-6 group-hover:opacity-100">
              <OptionIcon className="inline-block h-3 w-3" strokeWidth={3} />
              {' + 3'}
            </div>
          </Link>
        </li>
      </ul>
    </div>
  );
};

export default ResultsTabs;
