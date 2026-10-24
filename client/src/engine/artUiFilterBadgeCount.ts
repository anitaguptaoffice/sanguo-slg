/** ART-UI-FILTER-008 count badge: hide 0; 1–9 literal; >9 → 9+ (no 99+). */
export function formatUiFilterBadgeCount(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return "";
  if (n > 9) return "9+";
  return String(n);
}
