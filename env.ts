import { createEnv } from '@t3-oss/env-nextjs';
import { vercel } from '@t3-oss/env-nextjs/presets';
import { z } from 'zod';

const safeJSONParse = (input: string) => {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
};

export const env = createEnv({
  extends: [vercel()],
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).optional(),

    SITE_URL: z.string().url().optional(),
    INTERNAL_API_SECRET: z.string().min(1),

    ALLOWED_BOTS: z
      .string()
      .transform(safeJSONParse)
      .pipe(z.array(z.string()))
      .optional(),

    GOOGLE_SERVICE_KEY_B64: z.string().optional(),
    BIGQUERY_DATASET: z.string().optional(),
    BIGQUERY_LOCATION: z.string().optional(),

    GITHUB_TOKEN: z.string().optional(),
    GITHUB_SPONSORS_FEATURED_TIERS: z
      .string()
      .transform(safeJSONParse)
      .pipe(z.array(z.string()))
      .optional(),

    SPONSORS: z
      .string()
      .transform(safeJSONParse)
      .pipe(
        z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            logoUrl: z.string(),
            url: z.string(),
          }),
        ),
      )
      .optional(),
  },
  client: {
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN: z.string().optional(),
    NEXT_PUBLIC_PLAUSIBLE_HOST: z.string().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN,
    NEXT_PUBLIC_PLAUSIBLE_HOST: process.env.NEXT_PUBLIC_PLAUSIBLE_HOST,
  },
  emptyStringAsUndefined: true,
});
