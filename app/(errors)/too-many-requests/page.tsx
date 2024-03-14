import { type FC } from 'react';

const TooManyRequestsPage: FC = () => (
  <div className="mt-12 flex flex-col items-center gap-2">
    <h2>429 - Too Many Requests</h2>
    <p className="mt-2 text-center text-sm text-muted-foreground">
      Please try again later
    </p>
  </div>
);

export default TooManyRequestsPage;
