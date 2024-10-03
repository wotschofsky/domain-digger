import { getAccessToken } from 'web-auth-library/google';

import { env } from '@/env';

const credentials = env.GOOGLE_SERVICE_KEY_B64
  ? (JSON.parse(
      Buffer.from(env.GOOGLE_SERVICE_KEY_B64, 'base64').toString(),
    ) as {
      type: 'service_account';
      project_id: string;
      private_key: string;
      client_email: string;
    })
  : null;

export const insertRows = async ({
  datasetName,
  tableName,
  rows,
}: {
  datasetName: string;
  tableName: string;
  rows: Record<string, any>[];
}): Promise<void> => {
  const accessToken = await getAccessToken({
    // @ts-expect-error still works
    credentials: credentials,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  });

  const response = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${
      credentials!.project_id
    }/datasets/${datasetName}/tables/${tableName}/insertAll`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rows: rows.map((row) => ({ json: row })),
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to insert data into BigQuery: ${response.status} ${errorBody}`,
    );
  }
};

export const query = async <T extends Record<string, any>>({
  query,
  params,
}: {
  query: string;
  params?: Record<string, string>;
}): Promise<T[]> => {
  const accessToken = await getAccessToken({
    // @ts-expect-error still works
    credentials: credentials,
    scope: 'https://www.googleapis.com/auth/bigquery',
  });

  const queryParameters = params
    ? Object.keys(params).map((key) => ({
        name: key,
        parameterType: {
          type: typeof params[key] === 'number' ? 'INT64' : 'STRING',
        },
        parameterValue: { value: params[key] },
      }))
    : [];

  const response = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${
      credentials!.project_id
    }/queries`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'bigquery#queryRequest',
        useLegacySql: false,
        location: env.BIGQUERY_LOCATION,
        query,
        parameterMode: 'NAMED',
        queryParameters,
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to execute query in BigQuery: ${response.status} ${errorBody}`,
    );
  }

  const { schema, rows } = await response.json();

  if (!rows) {
    return [];
  }

  return rows.map((row: any) =>
    Object.fromEntries(
      row.f.map((field: any, index: number) => [
        schema.fields[index].name,
        field.v,
      ]),
    ),
  );
};

export const bigquery = credentials && {
  projectId: credentials.project_id,
  insertRows,
  query,
};
