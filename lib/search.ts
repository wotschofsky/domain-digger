import { env } from '@/env';
import { bigquery } from '@/lib/bigquery';
import { getBaseDomain } from '@/lib/utils';

type LookupLogPayload = {
  domain: string;
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
          baseDomain,
          timestamp: Math.floor(new Date().getTime() / 1000),
          ip: payload.ip,
          userAgent: payload.userAgent,
          isBot: payload.isBot,
        },
      ],
    })
    .catch((error) => {
      if ('errors' in error) {
        for (const err of error.errors) {
          console.error(err);
        }
      } else {
        console.error(error);
      }
    });
};

export const getSearchSuggestions = async (query: string) => {
  const segments = query.split('.').filter(Boolean);

  const suggestions = await Promise.all(
    // Limit to 2 segments to avoid abuse and keep results sensible
    segments.slice(0, 2).map(async (_, i) => {
      const querySegment = segments.slice(i).join('.');
      const suggestions = await getSearchSuggestionsForPrefix(querySegment);
      const prefix = i === 0 ? '' : segments.slice(0, i).join('.');
      return suggestions.map((s) => (prefix ? `${prefix}.${s}` : s));
    }),
  );

  return Array.from(new Set(suggestions.flat()));
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
