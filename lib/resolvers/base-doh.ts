import { RECORD_TYPES_BY_DECIMAL } from '../data';
import { DnsResolver, type RecordType, type ResolverResponse } from './base';

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
    private sendRequest: (
      domain: string,
      type: RecordType,
    ) => Promise<Response>,
  ) {
    super();
  }

  public async resolveRecordType(
    domain: string,
    type: RecordType,
  ): Promise<ResolverResponse> {
    const response = await this.sendRequest(domain, type);
    if (!response.ok)
      throw new Error(
        `Bad response from DoH Resolver: ${response.statusText} from ${response.url}`,
      );
    const results = (await response.json()) as DoHResponse;

    if (!results.Answer) {
      return {
        records: [],
        trace: [`HTTPS GET ${response.url} -> no answer`],
      };
    }

    const filteredAnswers = results.Answer.filter(
      (answer) =>
        answer.type in RECORD_TYPES_BY_DECIMAL &&
        // @ts-expect-error
        RECORD_TYPES_BY_DECIMAL[answer.type] === type,
    );

    const cleanedAnswers = filteredAnswers.map((answer) => ({
      name: answer.name,
      type,
      TTL: answer.TTL,
      data: answer.data,
    }));

    return {
      records: cleanedAnswers,
      trace: [
        `HTTPS GET ${response.url} -> answer: ${cleanedAnswers.map((a) => a.data).join(', ')}`,
      ],
    };
  }
}
