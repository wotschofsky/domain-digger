import { log } from 'evlog';

import { CloudflareDoHResolver } from '@/lib/resolvers/cloudflare';
import { getBaseDomain } from '@/lib/utils';

export type DnssecSummary = {
  domain: string;
  status: 'ds-present' | 'no-ds' | 'unavailable';
};

// Registrable domain, like the registrar and date tiles, even when a host is searched.
// A recursive DS query reads the parent's DS RRset: a delegation hint, not DNSSEC validation.
export const getDnssecSummary = async (
  domain: string,
): Promise<DnssecSummary> => {
  const baseDomain = getBaseDomain(domain);
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
