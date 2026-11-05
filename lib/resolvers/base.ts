import { log } from 'evlog';

import type { ALL_RECORD_TYPES } from '@/lib/data';
import {
  UserFacingError,
  type UserFacingErrorPayload,
} from '@/lib/user-facing-error';
import { serializeError } from '@/lib/utils';

export type RecordType = (typeof ALL_RECORD_TYPES)[number];

// Case-insensitive, trailing-dot-free form for comparing DNS names.
export const canonicalDnsName = (name: string): string =>
  name.replace(/\.$/, '').toLowerCase();

export type RawRecord = {
  name: string;
  type: RecordType;
  TTL: number;
  data: string;
};

export type ResolverResponse = {
  records: RawRecord[];
  trace: string[];
  // Set by resolveRecordTypes for a type whose lookup failed: it is unknown,
  // not a confirmed empty RRset. Keep this plain data so the response stays
  // JSON-serializable.
  error?: UserFacingErrorPayload;
};

export type ResolverMultiResponse = Record<string, ResolverResponse>;

const FALLBACK_LOOKUP_ERROR: UserFacingErrorPayload = {
  title: 'DNS lookup failed',
  description:
    'This record type could not be retrieved. Please try again shortly.',
  retryable: true,
};

export abstract class DnsResolver {
  // Throws when the lookup fails, so an empty result always means a
  // confirmed empty RRset.
  public abstract resolveRecordType(
    domain: string,
    type: RecordType,
  ): Promise<ResolverResponse>;

  // Keeps every type that resolved and marks each failed type with an error.
  public async resolveRecordTypes(
    domain: string,
    types: readonly RecordType[],
  ): Promise<ResolverMultiResponse> {
    const results = await Promise.allSettled(
      types.map((type) => this.resolveRecordType(domain, type)),
    );
    const firstFailure = results.find((result) => result.status === 'rejected');
    const hasRecords = results.some(
      (result) =>
        result.status === 'fulfilled' && result.value.records.length > 0,
    );
    // Empty successful types must not turn an entirely unusable lookup into
    // a misleading "no records" page (e.g. a broken DNSSEC chain or Route 53
    // delegation).
    if (firstFailure && !hasRecords) throw firstFailure.reason;

    const response: ResolverMultiResponse = {};
    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        response[types[index]] = result.value;
        continue;
      }
      const { reason } = result;
      const expected = reason instanceof UserFacingError;
      // Not rethrown, so onRequestError never sees it. Expected failures
      // (e.g. a refused PTR) only warn, so error alerts stay reserved for
      // bugs.
      log[expected ? 'warn' : 'error']({
        message: 'record_type_lookup_failed',
        domain,
        recordType: types[index],
        error: serializeError(reason),
      });
      const error = expected ? reason.payload : FALLBACK_LOOKUP_ERROR;
      response[types[index]] = { records: [], trace: [], error };
    }
    return response;
  }
}
