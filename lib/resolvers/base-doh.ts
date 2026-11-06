import { z } from 'zod';

import { RECORD_TYPES_BY_DECIMAL } from '../data';
import {
  UserFacingError,
  type UserFacingErrorPayload,
} from '../user-facing-error';
import { DnsResolver, type RecordType, type ResolverResponse } from './base';

const answerSchema = z.object({
  name: z.string(),
  type: z.number().int().nonnegative(),
  TTL: z.number().int().nonnegative(),
  data: z.string(),
});

const responseSchema = z.object({
  Status: z.number().int(),
  TC: z.boolean().optional(),
  Answer: z.array(answerSchema).optional(),
});

export type DoHAnswer = z.infer<typeof answerSchema>;
export type DoHResponse = z.infer<typeof responseSchema>;

export type DoHResolverResponse = {
  answers: DoHAnswer[];
  rcode: number;
  trace: string[];
};

export type DoHResolverOptions = {
  signal?: AbortSignal;
};

const recordTypes: Readonly<Record<number, RecordType | undefined>> =
  RECORD_TYPES_BY_DECIMAL;

// The resolver answered, but with an error status (e.g. SERVFAIL for a
// broken DNSSEC chain) or a truncated response.
export const INCOMPLETE_LOOKUP_ERROR: UserFacingErrorPayload = {
  title: 'DNS resolver could not complete the lookup',
  description:
    'The DNS resolver returned an error or incomplete response. Please try again shortly.',
  retryable: true,
};

export abstract class BaseDoHResolver extends DnsResolver {
  constructor(
    private readonly endpoint: string,
    private readonly accept: string,
    private readonly options: DoHResolverOptions = {},
  ) {
    super();
  }

  // `failure` is set when the resolver answered but could not complete the
  // lookup; HTTP and malformed responses throw.
  private async query(
    domain: string,
    type: RecordType,
  ): Promise<DoHResolverResponse & { failure?: string }> {
    const url = new URL(this.endpoint);
    url.searchParams.set('name', domain);
    url.searchParams.set('type', type);

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: this.accept },
      cache: 'no-store',
      signal: this.options.signal,
    });
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new UserFacingError(
        {
          title: 'DNS resolver is unavailable',
          description:
            'The DNS resolver returned an error and may be temporarily down. Please try again shortly.',
          retryable,
        },
        {
          cause: new Error(
            `Bad response from DoH Resolver: HTTP ${response.status} ${response.statusText} from ${response.url}`,
          ),
        },
      );
    }
    const results = responseSchema.parse(await response.json());
    const failure = results.TC
      ? 'Truncated DNS response'
      : [0, 3].includes(results.Status)
        ? undefined
        : `DNS status ${results.Status}`;

    const answers = failure ? undefined : results.Answer;
    return {
      answers: answers ?? [],
      rcode: results.Status,
      trace: [
        `HTTPS GET ${response.url} -> ${
          failure ??
          (answers
            ? `answer: ${answers.map((answer) => answer.data).join(', ')}`
            : 'no answer')
        }`,
      ],
      failure,
    };
  }

  // Preserve the whole answer section, including aliases and unknown types.
  // Throws on a DNS-level failure, so an empty result always means no data.
  public async resolveAnswers(
    domain: string,
    type: RecordType,
  ): Promise<DoHResolverResponse> {
    const { failure, ...response } = await this.query(domain, type);
    if (failure) {
      throw new UserFacingError(INCOMPLETE_LOOKUP_ERROR, {
        cause: new Error(failure),
      });
    }
    return response;
  }

  // Throws on a DNS-level failure, except for RRSIG: Cloudflare and Google
  // SERVFAIL direct RRSIG queries for healthy zones (e.g. Cloudflare-hosted
  // ones), so a failed RRSIG lookup reads as empty (noted in the trace), like
  // a refused one on the authoritative path. HTTP failures still throw.
  public async resolveRecordType(
    domain: string,
    type: RecordType,
  ): Promise<ResolverResponse> {
    const { answers, trace } =
      type === 'RRSIG'
        ? await this.query(domain, type)
        : await this.resolveAnswers(domain, type);

    const records = answers
      .filter((answer) => recordTypes[answer.type] === type)
      .map((answer) => ({
        name: answer.name,
        type,
        TTL: answer.TTL,
        data: answer.data,
      }));

    return { records, trace };
  }
}
