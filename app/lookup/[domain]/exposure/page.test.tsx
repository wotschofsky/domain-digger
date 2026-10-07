import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lookupLunarExposure } from '@/lib/lunar';
import { recordLookupAfter } from '@/lib/search';

import ExposureResultsPage from './page';

vi.mock('@/lib/lunar', () => ({ lookupLunarExposure: vi.fn() }));
vi.mock('@/lib/search', () => ({ recordLookupAfter: vi.fn() }));

const report = {
  domain: 'example.com',
  generated_at: '2026-10-01T12:00:00',
  period: { from: '2025-10-01', to: '2026-09-30' },
  summary: {
    total_events: 0,
    infostealer_events: 0,
    data_breach_events: 0,
    employee_events: 0,
    client_events: 0,
    first_seen: null,
    last_seen: null,
  },
};

const renderPage = async (run?: string | string[]) => {
  const element = await ExposureResultsPage({
    params: Promise.resolve({ domain: 'example.com' }),
    searchParams: Promise.resolve({ run }),
  });
  return renderToStaticMarkup(element);
};

describe('optional Exposure result flow', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([undefined, '0', ['1', '1']])(
    'does not request Lunar without explicit opt-in (%j)',
    async (run) => {
      const html = await renderPage(run);
      expect(html).toContain('Check exposure');
      expect(html).toContain('name="run"');
      expect(lookupLunarExposure).not.toHaveBeenCalled();
      expect(recordLookupAfter).not.toHaveBeenCalled();
    },
  );

  it('shows a pending report with manual retry instead of zero findings', async () => {
    vi.mocked(lookupLunarExposure).mockResolvedValue({
      status: 'GENERATING_REPORT',
      requestUuid: 'pending',
      domain: 'example.com',
      report: null,
    });
    const html = await renderPage('1');
    expect(lookupLunarExposure).toHaveBeenCalledWith('example.com');
    expect(html).toContain('Lunar is generating this report');
    expect(html).toContain('Check again');
    expect(html).not.toContain('No exposure events');
    expect(recordLookupAfter).not.toHaveBeenCalled();
  });

  it('renders a completed report with zero events and logs it correctly', async () => {
    vi.mocked(lookupLunarExposure).mockResolvedValue({
      status: 'REPORT_READY',
      requestUuid: 'ready',
      domain: 'example.com',
      periodFrom: report.period.from,
      periodTo: report.period.to,
      report,
    });
    const html = await renderPage('1');
    expect(html).toContain('No exposure events were found by Lunar');
    expect(html).toContain('Unavailable');
    expect(recordLookupAfter).toHaveBeenCalledWith(
      'example.com',
      'exposure',
      false,
    );
  });

  it('renders available breakdowns and records findings', async () => {
    vi.mocked(lookupLunarExposure).mockResolvedValue({
      status: 'REPORT_READY',
      requestUuid: 'ready',
      domain: 'example.com',
      periodFrom: report.period.from,
      periodTo: report.period.to,
      report: {
        ...report,
        summary: {
          ...report.summary,
          total_events: 1,
          infostealer_events: 1,
          employee_events: 1,
        },
        malware_family_breakdown: [
          { family: '<script>malware</script>', events: 1 },
        ],
        os_breakdown: [{ os_family: 'Windows 11', infostealer_events: 1 }],
      },
    });
    const html = await renderPage('1');
    expect(html).toContain('Windows 11');
    expect(html).toContain('&lt;script&gt;malware&lt;/script&gt;');
    expect(html).not.toContain('No exposure events');
    expect(recordLookupAfter).toHaveBeenCalledWith(
      'example.com',
      'exposure',
      true,
    );
  });

  it('maps denied domains to a non-retryable error', async () => {
    vi.mocked(lookupLunarExposure).mockResolvedValue({
      status: 'NOT_AUTHORIZED',
    });
    await expect(renderPage('1')).rejects.toMatchObject({
      payload: { title: 'Exposure lookup unavailable for this domain' },
    });
    expect(recordLookupAfter).not.toHaveBeenCalled();
  });

  it('lets upstream errors reach the Exposure error boundary', async () => {
    const error = new Error('upstream unavailable');
    vi.mocked(lookupLunarExposure).mockRejectedValue(error);
    await expect(renderPage('1')).rejects.toBe(error);
    expect(recordLookupAfter).not.toHaveBeenCalled();
  });
});
