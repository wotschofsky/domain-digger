import { describe, expect, it } from 'vitest';

import { formatSalePrice } from './format-sale-price';

describe('sale price formatting', () => {
  it.each([
    ['USD 71256', '$71,256'],
    ['EUR 2500', '€2,500'],
    ['GBP 1250.50', '£1,250.50'],
    ['JPY 5000', '¥5,000'],
    ['USD 0', '$0'],
    ['USD 10.00', '$10'],
    ['USD 10.5', '$10.50'],
    ['USD 1000000.00', '$1,000,000'],
    ['EUR 0.00', '€0'],
    ['JPY 10.00', '¥10'],
    ['BTC 10.0000', 'BTC\u00a010'],
    ['BTC 12.8900000', 'BTC\u00a012.89'],
    ['DOGE 11.4200', 'DOGE 11.42'],
    ['EUR 0.000001', '€0.000001'],
    ['USD 9007199254740993.01', '$9,007,199,254,740,993.01'],
  ])('formats %s as %s', (price, formatted) => {
    expect(formatSalePrice(price)).toBe(formatted);
  });

  it('keeps significant cryptocurrency precision without trailing zeros', () => {
    expect(formatSalePrice('BTC 0.000010')).toBe('BTC\u00a00.00001');
  });

  it.each(['TOKEN 100', 'not a price', 'USD -1', `USD 0.${'1'.repeat(101)}`])(
    'falls back to the original value for %s',
    (price) => expect(formatSalePrice(price)).toBe(price),
  );
});
