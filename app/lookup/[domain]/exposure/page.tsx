import type { Metadata } from 'next';
import type { FC } from 'react';

import { Button } from '@/components/ui/button';

import { lookupLunarExposure } from '@/lib/lunar';
import { recordLookupAfter } from '@/lib/search';
import { UserFacingError } from '@/lib/user-facing-error';

type ExposureResultsPageProps = {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ run?: string | string[] }>;
};

export const generateMetadata = async ({
  params,
}: ExposureResultsPageProps): Promise<Metadata> => {
  const { domain } = await params;
  return {
    title: `Domain Exposure for ${domain}`,
    alternates: { canonical: `/lookup/${domain}/exposure` },
    openGraph: {
      title: `Domain Exposure for ${domain}`,
      url: `/lookup/${domain}/exposure`,
    },
  };
};

const ExposureBreakdown: FC<{
  title: string;
  rows: { label: string; events: number }[];
}> = ({ title, rows }) =>
  rows.length > 0 && (
    <section>
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      <dl className="space-y-2">
        {rows.map((row, index) => (
          <div
            className="flex justify-between gap-4"
            key={`${row.label}-${index}`}
          >
            <dt className="break-words">{row.label}</dt>
            <dd className="shrink-0 font-mono">
              {row.events.toLocaleString('en-US')}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );

const ExposureResultsPage: FC<ExposureResultsPageProps> = async ({
  params,
  searchParams,
}) => {
  const { domain } = await params;
  const { run } = await searchParams;

  // Prefetching, crawlers and ordinary domain lookups must not query Lunar.
  const result = run === '1' ? await lookupLunarExposure(domain) : null;
  if (result?.status === 'NOT_AUTHORIZED') {
    throw new UserFacingError({
      title: 'Exposure lookup unavailable for this domain',
      description: 'Lunar does not allow exposure reports for this domain.',
    });
  }

  const report = result?.status === 'REPORT_READY' ? result.report : null;
  if (report) {
    await recordLookupAfter(
      domain,
      'exposure',
      report.summary.total_events > 0,
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Domain exposure</h2>
        <p className="text-zinc-600 dark:text-zinc-300">
          Check aggregated credential exposure from infostealer logs and data
          breaches. Checking sends {domain} to{' '}
          <a
            href="https://lunarcyber.com"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Lunar
          </a>
          . No account or API key is required.
        </p>
      </div>

      {result?.status === 'GENERATING_REPORT' && (
        <p role="status">
          Lunar is generating this report. This can take seconds to hours. Check
          again later.
        </p>
      )}

      {!report && (
        <form
          action={`/lookup/${encodeURIComponent(domain)}/exposure`}
          method="get"
        >
          <Button type="submit" name="run" value="1">
            {result ? 'Check again' : 'Check exposure'}
          </Button>
        </form>
      )}

      {report && (
        <>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Reporting period: {report.period.from} to {report.period.to}.
            Generated: {report.generated_at.replace('T', ' ')}.
          </p>

          {report.summary.total_events === 0 && (
            <p>
              No exposure events were found by Lunar during this reporting
              period.
            </p>
          )}

          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            {(
              [
                ['Total events', report.summary.total_events],
                ['Infostealer events', report.summary.infostealer_events],
                [
                  'Breach / combo-list events',
                  report.summary.data_breach_events,
                ],
                ['Employee exposure', report.summary.employee_events],
                ['Client exposure', report.summary.client_events],
              ] as const
            ).map(([label, count]) => (
              <div key={label}>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                  {label}
                </dt>
                <dd className="mt-1 text-2xl font-semibold">
                  {count.toLocaleString('en-US')}
                </dd>
              </div>
            ))}
          </dl>

          <p className="text-sm">
            First seen: {report.summary.first_seen ?? 'Unavailable'}. Last seen:{' '}
            {report.summary.last_seen ?? 'Unavailable'}.
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Employee exposure concerns accounts associated with this domain.
            Client exposure concerns users of its services. Counts represent
            exposure events, not unique people or proof that the domain itself
            was breached. No findings do not guarantee that credentials are
            safe.
          </p>

          <div className="grid gap-8 sm:grid-cols-2">
            <ExposureBreakdown
              title="Malware families"
              rows={(report.malware_family_breakdown ?? []).map((r) => ({
                label: r.family,
                events: r.events,
              }))}
            />
            <ExposureBreakdown
              title="Affected services"
              rows={(report.service_classification_breakdown ?? []).map(
                (r) => ({ label: r.service, events: r.events }),
              )}
            />
            <ExposureBreakdown
              title="Device operating systems"
              rows={(report.os_breakdown ?? []).map((r) => ({
                label: r.os_family,
                events: r.infostealer_events,
              }))}
            />
            <ExposureBreakdown
              title="Observed antivirus products"
              rows={(report.antivirus_breakdown ?? []).map((r) => ({
                label: r.antivirus,
                events: r.events,
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default ExposureResultsPage;
