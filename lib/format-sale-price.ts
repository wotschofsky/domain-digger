/** Format an RFC 10023 price without converting its exact decimal to a float. */
export const formatSalePrice = (price: string): string => {
  const match = /^([A-Z]+) (\d+(?:\.\d+)?)$/.exec(price);
  if (!match) return price;

  const [, currency, amount] = match;
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
      trailingZeroDisplay: fractionDigits ? 'auto' : 'stripIfInteger',
    }).format(amount as Intl.StringNumericLiteral);
  } catch {
    // Nonstandard currency codes remain readable instead of breaking the tile.
    return price;
  }
};
