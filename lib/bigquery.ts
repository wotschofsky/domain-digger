// @ts-expect-error
import { getAccessToken } from 'web-auth-library/google';

const credentials = process.env.GOOGLE_SERVICE_KEY_B64
  ? (JSON.parse(
      Buffer.from(process.env.GOOGLE_SERVICE_KEY_B64, 'base64').toString()
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
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to insert data into BigQuery: ${response.status} ${errorBody}`
    );
  }
};

export default credentials && {
  insertRows,
};
