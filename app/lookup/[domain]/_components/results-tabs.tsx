'use client';

import { OptionIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSelectedLayoutSegment } from 'next/navigation';
import type { FC } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { ClientOnly } from '@/components/client-only';
import { isAppleDevice } from '@/lib/utils';

type SingleTabProps = {
  label: string;
  href: string;
  selected: boolean;
  shortcutNumber: number;
};

const SingleTab: FC<SingleTabProps> = ({
  label,
  href,
  selected,
  shortcutNumber,
}) => (
  <li className="mr-2">
    <Link
      href={href}
      className={
        selected
          ? 'relative inline-block w-max rounded-t-lg border-b-2 border-primary p-4 text-primary'
          : 'relative inline-block w-max rounded-t-lg border-b-2 border-transparent p-4 hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300'
      }
    >
      {label}
      <ClientOnly>
        <span
          className="pointer-events-none absolute bottom-0 left-1/2 hidden w-full -translate-x-1/2 translate-y-4 text-xs text-muted-foreground opacity-0 transition-all group-hover:translate-y-6 group-hover:opacity-100 sm:block"
          aria-hidden
        >
          {isAppleDevice() ? (
            <>
              <OptionIcon className="inline-block h-3 w-3" strokeWidth={3} />
              {` + ${shortcutNumber}`}
            </>
          ) : (
            `alt+${shortcutNumber}`
          )}
        </span>
      </ClientOnly>
    </Link>
  </li>
);

type ResultsTabsProps = {
  domain: string;
};

export const ResultsTabs: FC<ResultsTabsProps> = ({ domain }) => {
  const router = useRouter();
  const selectedSegment = useSelectedLayoutSegment();

  useHotkeys('alt+1', () => router.push(`/lookup/${domain}`), [router]);
  useHotkeys('alt+2', () => router.push(`/lookup/${domain}/map`), [router]);
  useHotkeys('alt+3', () => router.push(`/lookup/${domain}/whois`), [router]);
  useHotkeys('alt+4', () => router.push(`/lookup/${domain}/certs`), [router]);
  useHotkeys('alt+5', () => router.push(`/lookup/${domain}/subdomains`), [
    router,
  ]);

  return (
    <div className="group mb-6 mt-6 border-b border-gray-200 text-center text-sm font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
      <ul className="-mb-px flex flex-wrap">
        <SingleTab
          label="DNS"
          href={`/lookup/${domain}`}
          selected={selectedSegment === '(dns)'}
          shortcutNumber={1}
        />
        <SingleTab
          label="DNS Map"
          href={`/lookup/${domain}/map`}
          selected={selectedSegment === 'map'}
          shortcutNumber={2}
        />
        <SingleTab
          label="Whois"
          href={`/lookup/${domain}/whois`}
          selected={selectedSegment === 'whois'}
          shortcutNumber={3}
        />
        <SingleTab
          label="Certs"
          href={`/lookup/${domain}/certs`}
          selected={selectedSegment === 'certs'}
          shortcutNumber={4}
        />
        <SingleTab
          label="Subdomains"
          href={`/lookup/${domain}/subdomains`}
          selected={selectedSegment === 'subdomains'}
          shortcutNumber={5}
        />
      </ul>
    </div>
  );
};
