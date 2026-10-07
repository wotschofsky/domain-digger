import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainSummary } from './domain-summary';

const fixtures = vi.hoisted(() => ({
  summary: vi.fn(),
  listing: {
    prices: ['EUR 2500'],
    links: ['https://seller.example/buy'],
    texts: ['Seller details should not appear'],
  },
}));

vi.mock('swr/immutable', () => ({ default: fixtures.summary }));

describe('domain summary sale link', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    fixtures.summary.mockReset();
    fixtures.summary.mockReturnValue({
      data: {
        whois: { registered: true, registrar: 'Example registrar' },
        sale: { domain: 'example.com', listing: fixtures.listing },
      },
      isLoading: false,
    });
    fixtures.listing.prices = ['EUR 2500'];
    fixtures.listing.links = ['https://seller.example/buy'];
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const render = async () => {
    await act(async () => root.render(<DomainSummary domain="example.com" />));
  };

  it('requires confirmation before exposing the outgoing link and allows cancellation', async () => {
    await render();
    expect(container.textContent).toContain('€2,500');
    expect(container.textContent).not.toContain('Seller details');
    expect(container.querySelector('details')).toBeNull();
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

  it('shows WHOIS without a sale tile when there is no listing', async () => {
    fixtures.summary.mockReturnValue({
      data: {
        whois: { registered: true, registrar: 'Example registrar' },
        sale: { domain: 'example.com', listing: null },
      },
      isLoading: false,
    });
    await render();
    expect(container.textContent).toContain('Example registrar');
    expect(container.textContent).not.toContain('For sale');
  });

  it('hides sale information for an unregistered domain', async () => {
    fixtures.summary.mockReturnValue({
      data: {
        whois: { registered: false },
        sale: { domain: 'example.com', listing: fixtures.listing },
      },
      isLoading: false,
    });
    await render();
    expect(container.textContent).toContain('Not registered');
    expect(container.textContent).not.toContain('For sale');
  });

  it('links an email listing to the seller’s email address', async () => {
    fixtures.listing.prices = ['USD 195000'];
    fixtures.listing.links = ['mailto:sales@sun.com.py'];
    await render();
    const link = container.querySelector('a')!;
    expect(link.textContent).toBe('$195,000');
    expect(link.getAttribute('href')).toBe('mailto:sales@sun.com.py');
    expect(link.getAttribute('aria-label')).toBe('Contact seller by email');
    expect(link.hasAttribute('target')).toBe(false);
    expect(container.querySelector('button')).toBeNull();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('supports email listings without an asking price', async () => {
    fixtures.listing.prices = [];
    fixtures.listing.links = ['mailto:seller@example.com'];
    await render();
    expect(container.querySelector('a')?.textContent).toBe(
      'Advertised for sale',
    );
  });

  it('prefers a website listing when an email address is also available', async () => {
    fixtures.listing.links = [
      'mailto:seller@example.com',
      'https://seller.example/buy',
    ];
    await render();
    expect(container.querySelector('a')).toBeNull();
    await act(async () => container.querySelector('button')!.click());
    expect(
      document.querySelector('[role="alertdialog"] a')?.getAttribute('href'),
    ).toBe('https://seller.example/buy');
  });

  it('shows a plain value when there is no website or email URL', async () => {
    fixtures.listing.links = ['tel:+4930123456'];
    await render();
    expect(container.textContent).toContain('€2,500');
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });
});
