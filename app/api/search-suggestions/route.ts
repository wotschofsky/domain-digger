import { NextResponse } from 'next/server';

import bigquery from '@/lib/bigquery';

export const runtime = 'edge';
export const preferredRegion = 'home';

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return new Response('Missing query', {
      status: 400,
    });
  }

  if (query.includes('%')) {
    return new Response('Invalid query', {
      status: 400,
    });
  }

  if (!bigquery) {
    return NextResponse.json([]);
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

  const suggestions = results.map((row: any) => row.baseDomain) as string[];

  return NextResponse.json(suggestions);
};
