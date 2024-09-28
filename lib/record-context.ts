import { RECORD_INSIGHTS } from './data';
import { hostLookupLoader } from './ips';
import type { ResolverMultiResponse } from './resolvers/base';

export type RecordContextEntry = {
  description: string;
  url?: string;
};

const getIpsInfo = async (ips: string[]): Promise<Record<string, string[]>> => {
  const hosts = await hostLookupLoader.loadMany(ips);
  return Object.fromEntries(
    ips
      .map((ip, index) => [ip, hosts[index]])
      .filter(([, hosts]) => Array.isArray(hosts)),
  );
};

export const getRecordContextEntries = async (
  records: ResolverMultiResponse,
) => {
  const allSubvalues: Record<string, RecordContextEntry[]> = {};

  const ips = records.A.records
    .map((r) => r.data)
    .concat(records.AAAA.records.map((r) => r.data));
  const ipsInfo = await getIpsInfo(ips);

  const flatRecords = Object.values(records).flatMap((r) => r.records);
  for (const record of flatRecords) {
    const subvalues: RecordContextEntry[] = [];

    const normalizedRecord = record.data.endsWith('.')
      ? record.data.slice(0, -1)
      : record.data;

    const possibleInsights = RECORD_INSIGHTS[record.type];
    for (const insight of possibleInsights) {
      if (insight.test.test(normalizedRecord)) {
        subvalues.push(insight);
      }
    }

    if (record.data in ipsInfo) {
      subvalues.push(
        ...ipsInfo[record.data].map((h) => ({
          description: h,
        })),
      );
    }

    if (subvalues.length > 0) {
      allSubvalues[record.data] = subvalues;
    }
  }

  return allSubvalues;
};
