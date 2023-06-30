'use client';

import { FaHeart } from 'react-icons/fa';

const Footer = () => (
  <footer className="w-full p-4 md:px-8">
    <div className="flex flex-col items-center justify-between border-t border-t-gray-200 pt-4 dark:border-t-gray-700 sm:flex-row">
      <p className="text-xs">
        Originally created with
        <>
          {' '}
          <FaHeart className="inline text-red-500" fontSize=".75rem" />
          <span className="sr-only">love</span>{' '}
        </>
        by{' '}
        <a href="https://github.com/feliskio/domain-digger" rel="noopener">
          Felix Wotschofsky
        </a>
      </p>
    </div>
  </footer>
);

export default Footer;
