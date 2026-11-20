import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainSummary } from './domain-summary';

const fixtures = vi.hoisted(() => ({
  summary: vi.fn(),
  retry: vi.fn(),
  sale: {
    fallbackDomain: null as string | null,
    prices: ['€2,500'],
    link: 'https://seller.example/buy' as string | null,
  },
}));
const tiles = (sale: typeof fixtures.sale | null = fixtures.sale) => ({
  status: 'registered',
  registrar: 'Example registrar',
  createdAt: 'Not listed',
  dnssec: 'Not listed',
  sale,
});

vi.mock('swr', () => ({ default: fixtures.summary }));

describe('domain summary sale link', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    fixtures.summary.mockReset();
    fixtures.retry.mockReset().mockResolvedValue(undefined);
    fixtures.sale.fallbackDomain = null;
    fixtures.sale.prices = ['€2,500'];
    fixtures.sale.link = 'https://seller.example/buy';
    fixtures.summary.mockReturnValue({
      data: tiles(),
      isLoading: false,
      isValidating: false,
      mutate: fixtures.retry,
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const render = async (domain = 'example.com') => {
    await act(async () => root.render(<DomainSummary domain={domain} />));
  };

  it('requires confirmation before exposing the outgoing link and allows cancellation', async () => {
    await render();
    expect(container.textContent).toContain('€2,500');
    const button = container.querySelector('button')!;
    expect(button.hasAttribute('aria-label')).toBe(false);
    expect(button.textContent).toContain('€2,500');
    expect(button.querySelector('.sr-only')?.textContent).toContain(
      'external website',
    );
    expect(document.querySelector('a')).toBeNull();

    await act(async () => container.querySelector('button')!.click());
    const dialog = document.querySelector('[role="alertdialog"]')!;
    expect(dialog.textContent).toContain('Domain Digger does not control');
    expect(dialog.textContent).toContain('https://seller.example/buy');
    const outgoing = dialog.querySelector('a')!;
    expect(outgoing.getAttribute('href')).toBe('https://seller.example/buy');
    expect(outgoing.target).toBe('_blank');
    expect(outgoing.rel).toBe('noopener noreferrer nofollow');

    await act(async () => dialog.querySelector('button')!.click());
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.querySelector('a')).toBeNull();
  });

  it('closes the confirmation when continuing', async () => {
    await render();
    await act(async () => container.querySelector('button')!.click());
    const outgoing = document.querySelector<HTMLAnchorElement>(
      '[role="alertdialog"] a',
    )!;
    // Avoid real navigation in the test while exercising the confirmation action.
    document.addEventListener('click', (event) => event.preventDefault(), {
      once: true,
    });
    await act(async () => outgoing.click());
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('requests WHOIS and sale information from one endpoint', async () => {
    await render();
    expect(fixtures.summary).toHaveBeenCalledWith(
      '/api/domain-summary?domain=example.com',
    );
    expect(container.textContent).toContain('Example registrar');
    expect(container.textContent).toContain('€2,500');
  });

  it('shows placeholders while the combined summary is loading', async () => {
    fixtures.summary.mockReturnValue({ data: undefined, isLoading: true });
    await render();
    expect(container.textContent).toContain('Registrar');
    expect(container.textContent).not.toContain('For sale');
    expect(container.querySelector('button')).toBeNull();
  });

  it('shows WHOIS without a sale tile', async () => {
    fixtures.summary.mockReturnValue({ data: tiles(null), isLoading: false });
    await render();
    expect(container.textContent).toContain('Example registrar');
    expect(container.textContent).toContain('Not listed');
    expect(container.textContent).not.toContain('For sale');
  });

  it('shows only the status of an unregistered domain', async () => {
    fixtures.summary.mockReturnValue({
      data: { status: 'unregistered' },
      isLoading: false,
    });
    await render();
    expect(container.textContent).toContain('Not registered');
    expect(container.textContent).not.toContain('Registrar');
  });

  it('links an email listing to the seller’s email address', async () => {
    fixtures.sale.prices = ['$195,000'];
    fixtures.sale.link = 'mailto:sales@sun.com.py';
    await render();
    const link = container.querySelector('a')!;
    expect(link.querySelector('span')?.textContent).toBe('$195,000');
    expect(link.getAttribute('href')).toBe('mailto:sales@sun.com.py');
    expect(link.hasAttribute('aria-label')).toBe(false);
    expect(link.querySelector('.sr-only')?.textContent).toContain(
      'Contact seller by email',
    );
    expect(link.hasAttribute('target')).toBe(false);
    expect(container.querySelector('button')).toBeNull();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('supports email listings without an asking price', async () => {
    fixtures.sale.prices = [];
    fixtures.sale.link = 'mailto:seller@example.com';
    await render();
    expect(container.querySelector('a span')?.textContent).toBe(
      'Advertised for sale',
    );
    expect(container.textContent).not.toContain('indicative');
  });

  it.each([
    { link: 'https://seller.example/buy' },
    { link: 'mailto:seller@example.com' },
    { link: null },
  ])('labels an advertised price as indicative: $link', async ({ link }) => {
    fixtures.sale.link = link;
    await render();
    expect(
      [...container.querySelectorAll('h3')].map((title) => title.textContent),
    ).toContain('For sale · indicative price');
  });

  it('shows a plain value when there is no link', async () => {
    fixtures.sale.link = null;
    await render();
    expect(container.textContent).toContain('€2,500');
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });

  it('identifies the fallback domain a listing sits on', async () => {
    fixtures.sale.fallbackDomain = 'example.com';
    await render('www.example.com');
    expect(container.textContent).toContain('For sale (example.com)');
  });

  it('shows a retryable error instead of loading forever, then recovers', async () => {
    const success = fixtures.summary();
    fixtures.summary.mockReturnValue({
      data: undefined,
      error: new Error('Request failed'),
      isLoading: false,
      isValidating: false,
      mutate: fixtures.retry,
    });
    await render();
    expect(container.querySelector('[role="alert"] span')?.textContent).toBe(
      'Domain summary unavailable',
    );
    expect(container.textContent).not.toContain('Registrar');
    expect(container.querySelector('button')?.textContent).toBe('Retry');
    fixtures.retry.mockImplementation(async () =>
      fixtures.summary.mockReturnValue(success),
    );
    await act(async () => container.querySelector('button')!.click());
    expect(fixtures.retry).toHaveBeenCalledOnce();
    await render();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain('Example registrar');
  });

  it('keeps the error state when a manual retry also fails', async () => {
    fixtures.retry.mockRejectedValue(new Error('Request failed'));
    fixtures.summary.mockReturnValue({
      data: undefined,
      error: new Error('Request failed'),
      isLoading: false,
      isValidating: false,
      mutate: fixtures.retry,
    });
    await render();
    await act(async () => container.querySelector('button')!.click());
    expect(fixtures.retry).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('disables additional retries while a request is in progress', async () => {
    fixtures.summary.mockReturnValue({
      data: undefined,
      error: new Error('Request failed'),
      isLoading: false,
      isValidating: true,
      mutate: fixtures.retry,
    });
    await render();
    const retry = container.querySelector('button')!;
    expect(retry.disabled).toBe(true);
    expect(retry.textContent).toBe('Retrying…');
  });

  it('keeps a loaded summary visible when revalidation fails', async () => {
    fixtures.summary.mockReturnValue({
      ...fixtures.summary(),
      error: new Error('Request failed'),
    });
    await render();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain('Example registrar');
    expect(container.textContent).toContain('€2,500');
  });
});
