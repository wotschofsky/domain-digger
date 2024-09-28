import type { ALL_RECORD_TYPES } from '@/lib/data';

export type RecordType = (typeof ALL_RECORD_TYPES)[number];

export type RawRecord = {
  name: string;
  type: RecordType;
  TTL: number;
  data: string;
};

export type ResolverResponse = { records: RawRecord[]; trace: string[] };

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
