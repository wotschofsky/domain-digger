import { createEnv } from '@t3-oss/env-nextjs';
import { vercel } from '@t3-oss/env-nextjs/presets';
import { z } from 'zod';

export const env = createEnv({
  extends: [vercel],
  server: {
    NODE_ENV: z.enum(['production']).optional(),

    SITE_URL: z.string().url().optional(),
    INTERNAL_API_SECRET: z.string().min(1),

    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

    GOOGLE_SERVICE_KEY_B64: z.string().optional(),
    BIGQUERY_DATASET: z.string().optional(),
    BIGQUERY_LOCATION: z.string().optional(),
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
