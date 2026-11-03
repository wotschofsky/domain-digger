import { log } from 'evlog';

import { CloudflareDoHResolver } from '@/lib/resolvers/cloudflare';
import { getBaseDomain } from '@/lib/utils';

export type DnssecSummary = {
  domain: string;
  status: 'ds-present' | 'no-ds' | 'unavailable';
};

// Matches the registrar/date tiles' registrable-domain scope, including when
// the searched name is a host. A recursive DS query retrieves the parent's DS
// RRset; this is a delegation indicator, not full DNSSEC validation.
export const getDnssecSummary = async (
  domain: string,
): Promise<DnssecSummary> => {
  const baseDomain = getBaseDomain(domain).toLowerCase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await new CloudflareDoHResolver({
      signal: controller.signal,
    }).resolveAnswers(baseDomain, 'DS');
    return {
      domain: baseDomain,
      status: response.answers.some(
        (answer) =>
          answer.type === 43 &&
          answer.name.toLowerCase().replace(/\.$/, '') === baseDomain,
      )
        ? 'ds-present'
        : 'no-ds',
    };
  } catch (error) {
    log.warn({ message: 'dnssec_summary_failed', domain: baseDomain, error });
    return { domain: baseDomain, status: 'unavailable' };
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
};
