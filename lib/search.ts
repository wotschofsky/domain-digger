import { log } from 'evlog';
import { headers } from 'next/headers';
import { after } from 'next/server';

import { env } from '@/env';
import { getVisitorIp, isUserBot } from '@/lib/api';
import { bigquery } from '@/lib/bigquery';
import type { LookupType } from '@/lib/lookup-features';
import { getBaseDomain } from '@/lib/utils';

export type { LookupType } from '@/lib/lookup-features';

type LookupLogPayload = {
  domain: string;
  lookupType: LookupType;
  hasResults: boolean;
  ip: string;
  userAgent: string | null;
  isBot: boolean;
};

export const recordLookup = async (payload: LookupLogPayload) => {
  if (!bigquery) {
    return;
  }

  const baseDomain = getBaseDomain(payload.domain);

  await bigquery
    .insertRows({
      datasetName: env.BIGQUERY_DATASET!,
      tableName: 'lookups',
      rows: [
        {
          domain: payload.domain,
          lookupType: payload.lookupType,
          hasResults: payload.hasResults,
          ip: payload.ip,
          userAgent: payload.userAgent,
          isBot: payload.isBot,
          baseDomain,
          timestamp: Math.floor(new Date().getTime() / 1000),
        },
      ],
    })
    .catch((error) => {
      if ('errors' in error) {
        for (const err of error.errors) {
          log.error({ message: 'bigquery_insert_failed', error: err });
        }
      } else {
        log.error({ message: 'bigquery_insert_failed', error });
      }
    });
};

export const recordLookupAfter = async (
  domain: string,
  lookupType: LookupType,
  hasResults: boolean,
) => {
  // Resolve headers up-front; the request scope may be torn down inside after().
  const headersList = await headers();
  const ip = getVisitorIp(headersList);
  const { isBot, userAgent } = isUserBot(headersList);
  after(async () => {
    await recordLookup({
      domain,
      lookupType,
      hasResults,
      ip,
      userAgent,
      isBot,
    });
  });
};

export const getSearchSuggestions = async (query: string) => {
  const primarySuggestions = await getSearchSuggestionsForPrefix(query);

  if (primarySuggestions.length > 0) {
    return primarySuggestions;
  }

  const segments = query.split('.').filter((s) => s.length > 0);
  if (segments.length < 2) {
    return [];
  }

  const secondarySuggestions = await getSearchSuggestionsForPrefix(
    segments.slice(1).join('.'),
  ).then((suggestions) => suggestions.map((s) => `${segments[0]}.${s}`));

  return secondarySuggestions;
};

export const getSearchSuggestionsForPrefix = async (prefix: string) => {
  if (!bigquery) {
    return [];
  }

  const tableName = `\`${bigquery.projectId}.${env.BIGQUERY_DATASET}.popular_domains\``;
  const results = await bigquery.query<{ domain: string }>({
    query: `
      SELECT domain
      FROM ${tableName}
      WHERE STARTS_WITH(domain, @prefix)
      ORDER BY count DESC
      LIMIT 5
    `,
    params: {
      prefix: prefix.toLowerCase(),
    },
  });

  return results.map((row) => row.domain);
};

export const getTopDomains = async (count: number) => {
  if (!bigquery) {
    return [];
  }

  const tableName = `\`${bigquery.projectId}.${env.BIGQUERY_DATASET}.popular_domains\``;
  const results = await bigquery.query<{ domain: string }>({
    query: `
      SELECT domain
      FROM ${tableName}
      WHERE domain IS NOT NULL
      ORDER BY count DESC
      LIMIT ${count}
    `,
  });

  return results.map((row) => row.domain);
};
