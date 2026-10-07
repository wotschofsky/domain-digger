import { z } from 'zod';

import { RECORD_TYPES_BY_DECIMAL } from '../data';
import { UserFacingError } from '../user-facing-error';
import { DnsResolver, type RecordType, type ResolverResponse } from './base';

export type DoHResponse = {
  Status: number;
  TC: boolean;
  RD: boolean;
  RA: boolean;
  AD: boolean;
  CD: boolean;
  Question: {
    name: string;
    type: number;
  }[];
  Answer?: {
    name: string;
    type: number;
    TTL: number;
    data: string;
  }[];
  Authority?: {
    name: string;
    type: number;
    TTL: number;
    data: string;
  }[];
};

type DoHAnswer = NonNullable<DoHResponse['Answer']>[number];

const responseSchema = z.object({
  Status: z.number().int(),
  TC: z.boolean().optional(),
  Answer: z
    .array(
      z.object({
        name: z.string(),
        type: z.number().int().nonnegative(),
        TTL: z.number().int().nonnegative(),
        data: z.string(),
      }),
    )
    .optional(),
});

const recordTypes: Readonly<Record<number, RecordType | undefined>> =
  RECORD_TYPES_BY_DECIMAL;

export abstract class BaseDoHResolver extends DnsResolver {
  constructor(
    private sendRequest: (
      domain: string,
      type: RecordType,
    ) => Promise<Response>,
  ) {
    super();
  }

  // Keep aliases and their TTLs for callers that need the whole answer section.
  public async resolveAnswers(
    domain: string,
    type: RecordType,
  ): Promise<{ answers: DoHAnswer[]; rcode: number; trace: string[] }> {
    const response = await this.sendRequest(domain, type);
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
    if (results.TC || ![0, 3].includes(results.Status)) {
      throw new UserFacingError(
        {
          title: 'DNS resolver could not complete the lookup',
          description:
            'The DNS resolver returned an error or incomplete response. Please try again shortly.',
          retryable: true,
        },
        {
          cause: new Error(
            results.TC
              ? 'Truncated DNS response'
              : `DNS status ${results.Status}`,
          ),
        },
      );
    }

    const answers = results.Answer;
    return {
      answers: answers ?? [],
      rcode: results.Status,
      trace: [
        `HTTPS GET ${response.url} -> ${
          answers
            ? `answer: ${answers.map((answer) => answer.data).join(', ')}`
            : 'no answer'
        }`,
      ],
    };
  }

  public async resolveRecordType(
    domain: string,
    type: RecordType,
  ): Promise<ResolverResponse> {
    const { answers, trace } = await this.resolveAnswers(domain, type);

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
