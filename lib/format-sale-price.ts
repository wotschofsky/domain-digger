/** Format an RFC 10023 price without converting its exact decimal to a float. */
export const formatSalePrice = (price: string): string => {
  const match = /^([A-Z]+) (\d+(?:\.\d+)?)$/.exec(price);
  if (!match) return price;

  const [, currency, rawAmount] = match;
  // Trailing fraction zeros carry no value; "12.8900000" reads as "12.89".
  const amount = rawAmount.includes('.')
    ? rawAmount.replace(/\.?0+$/, '')
    : rawAmount;
  const fractionDigits = amount.split('.')[1]?.length ?? 0;
  if (fractionDigits > 100) return price;

  try {
    // A fixed locale keeps server and client rendering consistent.
    const currencyDigits =
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2;
    const digits = Math.max(currencyDigits, fractionDigits);

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      trailingZeroDisplay: 'stripIfInteger',
    }).format(amount as Intl.StringNumericLiteral);
  } catch {
    // Nonstandard currency codes remain readable instead of breaking the tile.
    return `${currency} ${amount}`;
  }
};
