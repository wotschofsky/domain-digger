import DnsResolver, {
  type RawRecord,
  RECORD_TYPES_BY_DECIMAL,
  type RecordType,
} from './DnsResolver';

type DoHResponse = {
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

export default class GoogleDoHResolver extends DnsResolver {
  public async resolveRecordType(
    domain: string,
    type: RecordType
  ): Promise<RawRecord[]> {
    const response = await fetch(
      `https://dns.google/resolve?name=${domain}&type=${type}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );
    if (!response.ok)
      throw new Error(`Bad response from Google: ${response.statusText}`);
    const results = (await response.json()) as DoHResponse;

    return (
      results.Answer?.map((answer) => ({
        name: answer.name,
        type:
          answer.type in RECORD_TYPES_BY_DECIMAL
            ? // @ts-expect-error
              RECORD_TYPES_BY_DECIMAL[answer.type]
            : 'UNKNOWN',
        TTL: answer.TTL,
        data: answer.data,
      })) || []
    );
  }
}
