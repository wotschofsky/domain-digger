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
    </>
  );
};

export default Home;
