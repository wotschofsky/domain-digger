'use client';

import { FaGithub, FaHeart } from 'react-icons/fa';

import { Button } from '@/components/ui/button';

const Footer = () => (
  <footer className="w-full p-4 md:px-8">
    <div className="flex flex-col items-center justify-between border-t border-t-gray-200 pt-4 dark:border-t-gray-700 sm:flex-row">
      <p className="text-xs">
        Created with
        <>
          {' '}
          <FaHeart className="inline text-red-500" fontSize=".75rem" />
          <span className="sr-only">love</span>{' '}
        </>
        by{' '}
        <a href="https://felisk.io" rel="noopener">
          Felix Wotschofsky
        </a>
      </p>

      <Button variant="ghost" asChild>
        <a
          href="https://github.com/feliskio/domain-digger"
          target="_blank"
          rel="noopener"
        >
          <FaGithub className="h-4 w-4" />
        </a>
      </Button>
    </div>
  </footer>
);

export default Footer;
