import { headers } from 'next/headers';
import { getDomain } from 'tldts';

import { bigquery } from '@/lib/bigquery';

export const recordLookup = (domain: string) => {
  if (!bigquery) {
    return;
  }

  const baseDomain = getDomain(domain);

  const forwardedFor = headers().get('x-forwarded-for');
  const ip = (forwardedFor ?? '127.0.0.1').split(',')[0];

  bigquery
    .insertRows({
      datasetName: process.env.BIGQUERY_DATASET!,
      tableName: 'lookups',
      rows: [
        {
          domain,
          baseDomain,
          timestamp: Math.floor(new Date().getTime() / 1000),
          ip,
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
      ORDER BY COUNT(*) ASC
      LIMIT 5
    `,
    params: {
      query: `${query}%`,
    },
  });

  return results.map((row: any) => row.baseDomain) as string[];
};
