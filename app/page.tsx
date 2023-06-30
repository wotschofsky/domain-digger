import { Card } from '@/components/ui/card';

import BookmarkletLink from '@/components/BookmarkletLink';
import SearchForm from '@/components/SearchForm';

const Home = () => {
  return (
    <>
      <Card className="mx-auto my-16 max-w-lg p-6">
        <h2 className="mb-5 text-center text-xl font-semibold tracking-tight sm:text-2xl">
          Get details about any Domain
        </h2>

        <SearchForm autofocus={true} />
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
            className="underline"
            href="https://github.com/feliskio/domain-digger"
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
