import type { FC } from 'react';

export const WhoisResultsNotFound: FC = () => (
  <p className="mt-24 text-center text-zinc-500 dark:text-zinc-400">
    No WHOIS data is available for this domain. The domain may be unregistered
    or the WHOIS server may not return data for this TLD.
  </p>
);

export default WhoisResultsNotFound;
