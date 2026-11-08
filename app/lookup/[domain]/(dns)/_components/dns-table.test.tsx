import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DnsTable } from './dns-table';

describe('partial DNS results', () => {
  it('renders available records alongside an explicit warning for failed types', () => {
    const markup = renderToStaticMarkup(
      <DnsTable
        subvalues={{}}
        records={{
          A: {
            records: [
              {
                name: 'example.com',
                type: 'A',
                data: '203.0.113.10',
                TTL: 300,
              },
            ],
            trace: [],
          },
          PTR: {
            records: [],
            trace: [],
            error: {
              title: 'Authoritative DNS servers did not answer',
              description: 'Please try again.',
              retryable: true,
            },
          },
          AAAA: { records: [], trace: [] },
        }}
      />,
    );
    const container = document.createElement('div');
    container.innerHTML = markup;
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'PTR:',
    );
    expect(
      container.querySelector('[role="alert"]')?.textContent,
    ).not.toContain('AAAA:');
    expect(container.querySelector('table')?.textContent).toContain(
      '203.0.113.10',
    );
  });
});
