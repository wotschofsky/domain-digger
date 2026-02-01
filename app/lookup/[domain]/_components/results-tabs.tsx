'use client';

import { OptionIcon } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter, useSelectedLayoutSegment } from 'next/navigation';
import type { FC } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { ClientOnly } from '@/components/client-only';
import { cn, isAppleDevice } from '@/lib/utils';

type SingleTabProps = {
  label: string;
  href: string;
  selected: boolean;
};

const SingleTab: FC<SingleTabProps> = ({ label, href, selected }) => (
  <li>
    <Link
      href={href}
      className={cn(
        'relative inline-block w-max rounded-t-lg px-5 py-3 transition-colors',
        selected
          ? 'text-primary'
          : 'text-zinc-600 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300',
      )}
    >
      {selected && (
        <motion.div
          className="absolute inset-0 rounded-xl bg-white shadow-[0px_0px_0px_1px_rgba(9,9,11,0.07),0px_2px_2px_0px_rgba(9,9,11,0.05)] dark:bg-zinc-900 dark:shadow-[0px_0px_0px_1px_rgba(255,255,255,0.1)]"
          layoutId="activeTab"
          transition={{ type: 'spring', stiffness: 750, damping: 60 }}
        />
      )}
      <span className="relative">{label}</span>
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
    <div className="group relative overflow-x-auto overflow-y-hidden rounded-xl text-center text-sm font-medium shadow-[0px_0px_0px_1px_rgba(9,9,11,0.07),0px_2px_2px_0px_rgba(9,9,11,0.05)] dark:shadow-[0px_0px_0px_1px_rgba(255,255,255,0.1)]">
      <ul className="-mb-px flex">
        <SingleTab
          label="DNS"
          href={`/lookup/${domain}`}
          selected={selectedSegment === '(dns)'}
        />
        <SingleTab
          label="DNS Map"
          href={`/lookup/${domain}/map`}
          selected={selectedSegment === 'map'}
        />
        <SingleTab
          label="Whois"
          href={`/lookup/${domain}/whois`}
          selected={selectedSegment === 'whois'}
        />
        <SingleTab
          label="Certs"
          href={`/lookup/${domain}/certs`}
          selected={selectedSegment === 'certs'}
        />
        <SingleTab
          label="Subdomains"
          href={`/lookup/${domain}/subdomains`}
          selected={selectedSegment === 'subdomains'}
        />
      </ul>

      <ClientOnly>
        <kbd className="pointer-events-none absolute top-1/2 right-3 hidden h-5 -translate-y-1/2 items-center gap-1 rounded border border-zinc-200 bg-white px-1.5 font-mono text-[10px] font-medium opacity-100 select-none sm:flex dark:border-zinc-700 dark:bg-zinc-800">
          {isAppleDevice() ? (
            <>
              <OptionIcon className="inline-block size-2" strokeWidth={3} /> 1-5
            </>
          ) : (
            'ctrl+1-5'
          )}
        </kbd>
      </ClientOnly>
    </div>
  );
};
