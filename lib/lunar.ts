import { toASCII } from 'punycode';
import { z } from 'zod';

import { UserFacingError } from './user-facing-error';
import { isValidDomain } from './utils';

const REQUEST_TIMEOUT_MS = 8000;
const REPORT_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHED_REPORTS = 128;

const countSchema = z.number().int().nonnegative();
const dateSchema = z.iso.date();
const reportSchema = z.object({
  domain: z.string().min(1),
  // Lunar timestamps have nanosecond precision and no timezone suffix.
  generated_at: z.iso.datetime({ local: true }),
  period: z.object({ from: dateSchema, to: dateSchema }),
  summary: z.object({
    total_events: countSchema,
    infostealer_events: countSchema,
    data_breach_events: countSchema,
    employee_events: countSchema,
    client_events: countSchema,
    first_seen: dateSchema.nullable(),
    last_seen: dateSchema.nullable(),
  }),
  malware_family_breakdown: z
    .array(z.object({ family: z.string(), events: countSchema }))
    .optional(),
  service_classification_breakdown: z
    .array(z.object({ service: z.string(), events: countSchema }))
    .optional(),
  os_breakdown: z
    .array(z.object({ os_family: z.string(), infostealer_events: countSchema }))
    .optional(),
  antivirus_breakdown: z
    .array(z.object({ antivirus: z.string(), events: countSchema }))
    .optional(),
});

// Validate the fields this integration consumes, stripping unknown additions.
// Contract: https://docs.webz.io/docs/webz/dea-response-fields (Issue #107).
export const lunarExposureSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('REPORT_READY'),
    requestUuid: z.string().min(1),
    domain: z.string().min(1),
    periodFrom: dateSchema,
    periodTo: dateSchema,
    report: reportSchema,
  }),
  z.object({
    status: z.literal('GENERATING_REPORT'),
    requestUuid: z.string().min(1),
    domain: z.string().min(1),
    report: z.null().optional(),
  }),
  z.object({
    status: z.literal('NOT_AUTHORIZED'),
  }),
]);

export type LunarExposure = z.infer<typeof lunarExposureSchema>;
export type LunarReport = z.infer<typeof reportSchema>;

const normalizeLunarDomain = (input: string) => {
  const domain = toASCII(input.trim().toLowerCase().replace(/\.$/, ''));
  if (
    !isValidDomain(domain) ||
    !domain.includes('.') ||
    domain.includes('*') ||
    domain.includes('_')
  ) {
    throw new UserFacingError({
      title: 'Invalid exposure domain',
      description: 'Enter a domain name without wildcards to check exposure.',
    });
  }
  return domain;
};

const requestExposure = async (
  domain: string,
  fetcher: typeof fetch,
): Promise<LunarExposure> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetcher(
        'https://api.lunarcyber.com/domain-exposure?' +
          new URLSearchParams({ domain }),
        {
          signal: controller.signal,
          // Cache only validated ready reports, never upstream errors/pending data.
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        },
      );
    } catch (error) {
      throw new UserFacingError(
        {
          title: "Couldn't reach Lunar",
          description:
            'The exposure request failed or timed out. Please try again shortly.',
          retryable: true,
        },
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new UserFacingError(
        {
          title:
            response.status === 429
              ? 'Lunar is rate limiting requests'
              : 'Lunar exposure lookup failed',
          description:
            'Lunar could not complete this lookup. Please try again later.',
          retryable:
            response.status === 408 ||
            response.status === 429 ||
            response.status >= 500,
        },
        { cause: new Error(`Lunar responded with HTTP ${response.status}`) },
      );
    }

    try {
      const result = lunarExposureSchema.parse(await response.json());
      if (
        result.status !== 'NOT_AUTHORIZED' &&
        result.domain.toLowerCase() !== domain
      ) {
        throw new Error('Lunar response domain does not match the request');
      }
      if (
        result.status === 'REPORT_READY' &&
        (result.report.domain.toLowerCase() !== domain ||
          result.periodFrom !== result.report.period.from ||
          result.periodTo !== result.report.period.to)
      ) {
        throw new Error('Lunar report does not match the request metadata');
      }
      return result;
    } catch (error) {
      throw new UserFacingError(
        {
          title: 'Invalid Lunar response',
          description:
            'Lunar returned an incomplete or unexpected exposure report. Please try again later.',
          retryable: true,
        },
        { cause: error },
      );
    }
  } finally {
    // Keep the timeout active while reading the body, not just the headers.
    clearTimeout(timeout);
  }
};

export const createLunarClient = (fetcher: typeof fetch = fetch) => {
  // Bounded, process-local cache; serverless cold starts may repeat requests.
  const cache = new Map<string, { result: LunarExposure; expiresAt: number }>();
  const pending = new Map<string, Promise<LunarExposure>>();

  return async (input: string): Promise<LunarExposure> => {
    const domain = normalizeLunarDomain(input);
    const cached = cache.get(domain);
    if (cached && cached.expiresAt > Date.now()) return cached.result;
    cache.delete(domain);

    const existing = pending.get(domain);
    if (existing) return existing;

    const request = requestExposure(domain, fetcher)
      .then((result) => {
        if (result.status === 'REPORT_READY') {
          if (cache.size >= MAX_CACHED_REPORTS) {
            cache.delete(cache.keys().next().value!);
          }
          cache.set(domain, {
            result,
            expiresAt: Date.now() + REPORT_CACHE_TTL_MS,
          });
        }
        return result;
      })
      .finally(() => pending.delete(domain));
    pending.set(domain, request);
    return request;
  };
};

// Resolve global fetch at request time (also supports test stubs).
export const lookupLunarExposure = createLunarClient((...args) =>
  fetch(...args),
);
