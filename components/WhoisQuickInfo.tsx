import { FC } from 'react';
import whoiser, { type WhoisSearchResult } from 'whoiser';

import { Skeleton } from './ui/skeleton';

type WhoisQuickInfoProps = {
  domain: string;
};

const WhoisQuickInfo: FC<WhoisQuickInfoProps> = async ({ domain }) => {
  const results = await whoiser(domain, {
    timeout: 5000,
  });
  const firstResult = results[
    // @ts-expect-error
    Object.keys(results).filter((key) => !('error' in results[key]))[0]
  ] as WhoisSearchResult;

  return (
    <div className="my-8 flex gap-8">
      <div>
        <h3 className="text-xs text-muted-foreground">Registrar</h3>
        <p className="text-sm">
          {firstResult && 'Registrar' in firstResult
            ? firstResult['Registrar'].toString()
            : 'Unavailable'}
        </p>
      </div>
      <div>
        <h3 className="text-xs text-muted-foreground">Creation Date</h3>
        <p className="text-sm">
          {firstResult && 'Created Date' in firstResult
            ? new Date(
                firstResult['Created Date'].toString()
              ).toLocaleDateString('en-US')
            : 'Unavailable'}
        </p>
      </div>
      <div>
        <h3 className="text-xs text-muted-foreground">DNSSEC</h3>
        <p className="text-sm">
          {firstResult && 'DNSSEC' in firstResult
            ? firstResult['DNSSEC'].toString()
            : 'Unavailable'}
        </p>
      </div>
    </div>
  );
};

export default WhoisQuickInfo;

export const WhoisQuickInfoPlaceholder: FC = () => (
  <div className="my-8 flex gap-8">
    <div>
      <h3 className="text-xs text-muted-foreground">Registrar</h3>
      <Skeleton className="mt-1 h-4 w-24 rounded-sm" />
    </div>
    <div>
      <h3 className="text-xs text-muted-foreground">Creation Date</h3>
      <Skeleton className="w-18 mt-1 h-4 rounded-sm" />
    </div>
    <div>
      <h3 className="text-xs text-muted-foreground">DNSSEC</h3>
      <Skeleton className="mt-1 h-4 w-16 rounded-sm" />
    </div>
  </div>
);
