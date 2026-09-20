/** Compact number display: 12, 7.5, 33.33 — no trailing noise. */
export function fmt(n: number): string {
  if (Math.abs(n) < 1e-9) return '0';
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}
