# Setting Up Domain Digger

> Read [CONTRIBUTING.md](./CONTRIBUTING.md) for what to know when contributing to Domain Digger 👀

## About the project

Domain Digger is built with the Next.js App Router and relies on some Vercel-exclusive features (namely, regional edge functions) for full functionality. The app is styled with Tailwind and shadcn/ui.

Dependencies are managed by [pnpm](https://pnpm.io/installation) and can be installed by running `pnpm i`.

Development mode can be initiated using `pnpm dev`. For production, the app should be deployed on Vercel to ensure all features function as expected.

The codebase can and should be formatted with Prettier using `pnpm format`.

## Configuring the project

For full functionality, Domain Digger relies on Google BigQuery.

Credentials are provided through environment variables. Using [a .env file as per the Next.js docs](https://nextjs.org/docs/basic-features/environment-variables#loading-environment-variables) is recommended. All required variables are documented in the [example env file](./.env.example).

### Deployment Platform

As of writing this, Vercel is the only platform able to correctly deploy Domain Digger. Both Cloudflare Pages and Netlify do not correctly support all required features.

While a traditional non-serverless deployment is possible, the DNS map won't work correctly.

### Google Cloud

Configuring Google Cloud _is not_ required to run the codebase.

#### Creating the BigQuery dataset

Use the following schema for creating the dataset:

```json
[
  {
    "name": "domain",
    "mode": "NULLABLE",
    "type": "STRING",
    "description": null,
    "fields": []
  },
  {
    "name": "lookupType",
    "mode": "NULLABLE",
    "type": "STRING",
    "description": null,
    "fields": []
  },
  {
    "name": "hasResults",
    "mode": "NULLABLE",
    "type": "BOOLEAN",
    "description": null,
    "fields": []
  },
  {
    "name": "ip",
    "mode": "NULLABLE",
    "type": "STRING",
    "description": null,
    "fields": []
  },
  {
    "name": "userAgent",
    "mode": "NULLABLE",
    "type": "STRING",
    "description": null,
    "fields": []
  },
  {
    "name": "isBot",
    "mode": "NULLABLE",
    "type": "BOOLEAN",
    "description": null,
    "fields": []
  },
  {
    "name": "baseDomain",
    "mode": "NULLABLE",
    "type": "STRING",
    "description": null,
    "fields": []
  },
  {
    "name": "timestamp",
    "mode": "NULLABLE",
    "type": "TIMESTAMP",
    "description": null,
    "fields": []
  }
]
```

Next, create a materialized view. Make sure to replace `project`, `dataset` with your project ID and dataset name:

```sql
CREATE OR REPLACE MATERIALIZED VIEW `project.dataset.popular_domains`
OPTIONS(
  refresh_interval_minutes = 360,
  enable_refresh = true
) AS
SELECT
  baseDomain as domain,
  COUNT(*) AS count
FROM
  `project.dataset.lookups`
WHERE
  baseDomain IS NOT NULL
  AND hasResults = TRUE
GROUP BY
  baseDomain;
```

#### Migrating an existing dataset

If your `lookups` table predates the `hasResults` and `lookupType` columns, add them and recreate the materialized view above. Optionally backfill `hasResults` so popularity isn't reset on deploy.

```sql
ALTER TABLE `project.dataset.lookups`
ADD COLUMN hasResults BOOL,
ADD COLUMN lookupType STRING;

-- Optional backfill: treat all historical rows as successful lookups.
UPDATE `project.dataset.lookups`
SET hasResults = TRUE
WHERE hasResults IS NULL;
```

Then re-run the `CREATE OR REPLACE MATERIALIZED VIEW` statement from the previous section so the view picks up the new `hasResults` filter.

#### Creating a service account

When creating a service account, ensure that the following permissions are granted:

- `bigquery.datasets.get`
- `bigquery.datasets.getIamPolicy`
- `bigquery.jobs.create`
- `bigquery.tables.get`
- `bigquery.tables.getData`
- `bigquery.tables.updateData`

In order to only grant the minimal required permissions, a custom role needs to be created.
