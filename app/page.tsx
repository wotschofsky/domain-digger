import BookmarkletLink from '@/components/BookmarkletLink';
import SearchForm from '@/components/SearchForm';

import { Card } from '@/components/ui/card';

export const metadata = {
  title: 'Domain Digger',
};

const Home = () => {
  return (
    <>
      <Card className="max-w-lg mx-auto my-16 p-6">
        <h2 className="text-center text-xl sm:text-2xl font-semibold tracking-tight mb-5">
          Get details about any Domain
        </h2>

        <SearchForm />
      </Card>

      <Card className="max-w-lg mx-auto my-16 p-6">
        <h2 className="text-center text-xl sm:text-2xl font-semibold tracking-tight mb-5">
          Quickly inspect any Website
        </h2>

        <p className="text-sm text-center text-muted-foreground mt-2 mb-5">
          Drag this link to your bookmarks bar to quickly go to the results page
          for the site you are currently on!
        </p>

        <BookmarkletLink />
      </Card>
    </>
  );
};

export default Home;
