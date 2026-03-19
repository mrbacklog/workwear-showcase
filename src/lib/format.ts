/**
 * Formatting utilities for the showcase.
 *
 * All prices are stored as EUR cents (integer). These helpers convert
 * to human-readable Dutch-locale strings.
 */

// ---------------------------------------------------------------------------
// Price formatter (shared instance)
// ---------------------------------------------------------------------------

const eurFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Format a price in cents to a Dutch EUR string.
 *
 * @param cents - Price in EUR cents (e.g. 8995)
 * @returns Formatted string (e.g. "€ 89,95")
 *
 * @example
 * formatPrice(8995)  // "€ 89,95"
 * formatPrice(0)     // "€ 0,00"
 */
export function formatPrice(cents: number): string {
  return eurFormatter.format(cents / 100);
}

/**
 * Format a price range. Returns a single price if min === max.
 *
 * @param min - Minimum price in EUR cents
 * @param max - Maximum price in EUR cents
 * @returns Formatted range string
 *
 * @example
 * formatPriceRange(8995, 12995)  // "€ 89,95 - € 129,95"
 * formatPriceRange(8995, 8995)   // "€ 89,95"
 */
export function formatPriceRange(min: number, max: number): string {
  if (min === max) {
    return formatPrice(min);
  }

  return `${formatPrice(min)} - ${formatPrice(max)}`;
}
