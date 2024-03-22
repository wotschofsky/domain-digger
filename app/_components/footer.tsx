'use client';

import { FaGithub, FaHeart } from 'react-icons/fa';

import { Button } from '@/components/ui/button';

export const Footer = () => (
  <footer className="w-full p-4 md:px-8">
    <div className="flex items-center justify-between border-t pt-4">
      <p className="text-sm">
        Created with{' '}
        <FaHeart className="inline text-red-500" fontSize="1.25rem" />
        <span className="sr-only">love</span> by{' '}
        <a
          className="underline decoration-dotted underline-offset-4"
          href="https://wotschofsky.com"
          target="_blank"
          rel="noopener"
          aria-label="Felix Wotschofsky (Site Creator)"
        >
          Felix Wotschofsky
        </a>
      </p>

      <Button variant="ghost" asChild>
        <a
          href="https://github.com/wotschofsky/domain-digger"
          target="_blank"
          rel="noopener"
        >
          <FaGithub className="h-6 w-6" />
          <span className="sr-only">GitHub Repository</span>
        </a>
      </Button>
    </div>
  </footer>
);
