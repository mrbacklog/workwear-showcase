const SIZE_ORDER: Record<string, number> = {
  'XXS': 1, 'XS': 2, 'S': 3, 'M': 4, 'L': 5, 'XL': 6,
  'XXL': 7, '2XL': 7, '3XL': 8, '4XL': 9, '5XL': 10, '6XL': 11,
};

export function compareSizes(a: string, b: string): number {
  const aNum = parseFloat(a);
  const bNum = parseFloat(b);
  if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
  const aUpper = a.toUpperCase();
  const bUpper = b.toUpperCase();
  const aOrd = SIZE_ORDER[aUpper];
  const bOrd = SIZE_ORDER[bUpper];
  if (aOrd !== undefined && bOrd !== undefined) return aOrd - bOrd;
  if (aOrd !== undefined) return -1;
  if (bOrd !== undefined) return 1;
  if (!isNaN(aNum)) return -1;
  if (!isNaN(bNum)) return 1;
  return a.localeCompare(b);
}
