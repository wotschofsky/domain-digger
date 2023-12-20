import { FC } from 'react';
import whoiser, { type WhoisSearchResult } from 'whoiser';

import isValidDomain from '@/utils/isValidDomain';

import { Skeleton } from './ui/skeleton';

type WhoisQuickInfoProps = {
  domain: string;
};

const getSummary = async (
  domain: string
): Promise<{ registrar: string; createdAt: string; dnssec: string }> => {
  // TODO Allow resolving for TLDs
  if (!isValidDomain(domain)) {
    return {
      registrar: 'Unavailable',
      createdAt: 'Unavailable',
      dnssec: 'Unavailable',
    };
  }

  try {
    const results = await whoiser(domain, {
      timeout: 5000,
    });

    const resultsKey = Object.keys(results).find(
      // @ts-expect-error
      (key) => !('error' in results[key])
    );
    if (!resultsKey) {
      throw new Error('No valid results found for domain ' + domain);
    }
    const firstResult = results[resultsKey] as WhoisSearchResult;

    return {
      registrar: firstResult['Registrar']?.toString() || 'Unavailable',
      createdAt:
        firstResult && 'Created Date' in firstResult
          ? new Date(firstResult['Created Date'].toString()).toLocaleDateString(
              'en-US'
            )
          : 'Unavailable',
      dnssec: firstResult['DNSSEC']?.toString() || 'Unavailable',
    };
  } catch (error) {
    console.error(error);
    return {
      registrar: 'Unavailable',
      createdAt: 'Unavailable',
      dnssec: 'Unavailable',
    };
  }
};

const WhoisQuickInfo: FC<WhoisQuickInfoProps> = async ({ domain }) => {
  const results = await getSummary(domain);

  return (
    <div className="my-8 flex gap-8">
      <div>
        <h3 className="text-xs text-muted-foreground">Registrar</h3>
        <p className="text-sm">{results.registrar}</p>
      </div>
      <div>
        <h3 className="text-xs text-muted-foreground">Creation Date</h3>
        <p className="text-sm">{results.createdAt}</p>
      </div>
      <div>
        <h3 className="text-xs text-muted-foreground">DNSSEC</h3>
        <p className="text-sm">{results.dnssec}</p>
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
