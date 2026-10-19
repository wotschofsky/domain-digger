import type { ALL_RECORD_TYPES } from '@/lib/data';
import type { UserFacingErrorPayload } from '@/lib/user-facing-error';

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
  // Set only by AuthoritativeResolver.resolveRecordTypes for a type whose
  // lookup failed: it is unknown, not a confirmed empty RRset. Other paths
  // (DoH DNS-level errors, tolerated RRSIG refusals) still return a failed
  // lookup as an empty response noted only in the trace. Keep this plain
  // data so partial responses can cross the server/client boundary.
  error?: UserFacingErrorPayload;
};

export type ResolverMultiResponse = Record<string, ResolverResponse>;

export abstract class DnsResolver {
  public abstract resolveRecordType(
    domain: string,
    type: RecordType,
  ): Promise<ResolverResponse>;

  public async resolveRecordTypes(
    domain: string,
    types: readonly RecordType[],
  ): Promise<ResolverMultiResponse> {
    const results = await Promise.all(
      types.map((type) => this.resolveRecordType(domain, type)),
    );

    return types.reduce(
      (res, type, index) => ({
        ...res,
        [type]: results[index],
      }),
      {} as ResolverMultiResponse,
    );
  }
}
