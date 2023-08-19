import Link from 'next/link';

import { Card } from '@/components/ui/card';

import BookmarkletLink from '@/components/BookmarkletLink';
import SearchForm from '@/components/SearchForm';

const EXAMPLE_DOMAINS = [
  'digger.tools',
  'google.com',
  'wikipedia.org',
  'microsoft.com',
  'tiktok.com',
  'reddit.com',
  'baidu.com',
  'twitter.com',
  'discord.com',
];

const Home = () => {
  return (
    <>
      <Card className="mx-auto my-16 max-w-lg p-6">
        <h1 className="mb-5 text-center text-xl font-semibold tracking-tight sm:text-2xl">
          Get details about any Domain
        </h1>

        <SearchForm autofocus={true} />

        <div className="mt-6 flex flex-wrap justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {EXAMPLE_DOMAINS.map((domain) => (
            <Link
              key={domain}
              className="underline decoration-dotted underline-offset-4"
              href={`/lookup/${domain}`}
            >
              {domain}
            </Link>
          ))}
        </div>
      </Card>

      <Card className="mx-auto my-16 max-w-lg p-6">
        <h2 className="mb-5 text-center text-xl font-semibold tracking-tight sm:text-2xl">
          Quick Inspect Bookmarklet
        </h2>

        <p className="mb-5 mt-2 text-center text-sm text-muted-foreground">
          Drag this link to your bookmarks bar to quickly go to the results page
          for the site you are currently on!
        </p>

        <BookmarkletLink />
      </Card>

      <div className="mx-auto my-16 max-w-lg p-6">
        <h2 className="mb-5 text-center text-xl font-semibold tracking-tight sm:text-2xl">
          About Domain Digger
        </h2>

        <p className="mb-5 mt-2 text-center text-sm text-muted-foreground">
          Domain Digger is the easy but incredibly powerful tool for looking up
          and quickly inspecting DNS records, WHOIS data, SSL/TLS certificate
          history and other domain related data. No installation required!
        </p>
        <p className="mb-5 mt-2 text-center text-sm text-muted-foreground">
          Domain Digger is entirely free and{' '}
          <a
            className="underline decoration-dotted underline-offset-4"
            href="https://github.com/wotschofsky/domain-digger"
            target="_blank"
            rel="noopener"
          >
            open source
          </a>
          . Any contributions are welcome!
        </p>
      </div>
    </>
  );
};

export default Home;
