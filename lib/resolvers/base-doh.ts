import {
  DnsResolver,
  type RawRecord,
  RECORD_TYPES_BY_DECIMAL,
  type RecordType,
} from './base';

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

export abstract class BaseDoHResolver extends DnsResolver {
  constructor(
    private sendRequest: (domain: string, type: RecordType) => Promise<Response>
  ) {
    super();
  }

  public async resolveRecordType(
    domain: string,
    type: RecordType
  ): Promise<RawRecord[]> {
    const response = await this.sendRequest(domain, type);
    if (!response.ok)
      throw new Error(`Bad response from Google: ${response.statusText}`);
    const results = (await response.json()) as DoHResponse;

    if (!results.Answer) {
      return [];
    }

    const filteredAnswers = results.Answer.filter(
      (answer) =>
        answer.type in RECORD_TYPES_BY_DECIMAL &&
        // @ts-expect-error
        RECORD_TYPES_BY_DECIMAL[answer.type] === type
    );

    return filteredAnswers.map((answer) => ({
      name: answer.name,
      type,
      TTL: answer.TTL,
      data: answer.data,
    }));
  }
}
