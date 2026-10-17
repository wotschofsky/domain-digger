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
  // A failed type is unknown, not a confirmed empty RRset. Keep this plain
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
