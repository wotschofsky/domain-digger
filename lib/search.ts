import { headers } from 'next/headers';
import { getDomain } from 'tldts';

import { bigquery } from '@/lib/bigquery';

export const recordLookup = (data: { domain: string; isBot: boolean }) => {
  if (!bigquery) {
    return;
  }

  // Remove wildcard prefix to avoid base domain not being extracted correctly
  // Remove trailing dot
  const cleanedDomain = data.domain.replace(/^\*\./, '').replace(/\.$/, '');
  const baseDomain = getDomain(cleanedDomain) || cleanedDomain;

  const forwardedFor = headers().get('x-forwarded-for');
  const ip = (forwardedFor ?? '127.0.0.1').split(',')[0];

  bigquery
    .insertRows({
      datasetName: process.env.BIGQUERY_DATASET!,
      tableName: 'lookups',
      rows: [
        {
          domain: data.domain,
          baseDomain,
          timestamp: Math.floor(new Date().getTime() / 1000),
          ip,
          isBot: data.isBot,
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
  if (!bigquery) {
    return [];
  }

  const tableName = `\`${bigquery.projectId}.${process.env.BIGQUERY_DATASET}.lookups\``;
  const results = await bigquery.query({
    query: `
      SELECT baseDomain
      FROM ${tableName}
      WHERE baseDomain LIKE @query
      GROUP BY baseDomain
      ORDER BY COUNT(*) DESC
      LIMIT 5
    `,
    params: {
      query: `${query}%`,
    },
  });

  return results.map((row: any) => row.baseDomain) as string[];
};

export const getTopDomains = async (count: number) => {
  if (!bigquery) {
    return [];
  }

  const tableName = `\`${bigquery.projectId}.${process.env.BIGQUERY_DATASET}.lookups\``;
  const results = await bigquery.query({
    query: `
      SELECT baseDomain
      FROM ${tableName}
      WHERE baseDomain IS NOT NULL
      GROUP BY baseDomain
      ORDER BY COUNT(*) DESC
      LIMIT ${count}
    `,
  });

  return results.map((row: any) => row.baseDomain) as string[];
};
