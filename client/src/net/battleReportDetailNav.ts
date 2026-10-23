/** DOM id 前缀：战报回合表行，供回合跳转滚动定位。 */
export const BATTLE_REPORT_ROUND_ROW_ID_PREFIX = "battle-round-row-";

/** 超过该回合数时顶栏用下拉而非 chips。 */
export const BATTLE_REPORT_ROUND_JUMP_CHIP_MAX = 12;

export function battleReportRoundRowDomId(roundNumber: number): string {
  const n = Math.trunc(roundNumber);
  return `${BATTLE_REPORT_ROUND_ROW_ID_PREFIX}${n}`;
}

export function parseBattleReportRoundRowDomId(elementId: string): number | null {
  if (!elementId.startsWith(BATTLE_REPORT_ROUND_ROW_ID_PREFIX)) return null;
  const n = Number(elementId.slice(BATTLE_REPORT_ROUND_ROW_ID_PREFIX.length));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export function shouldUseBattleReportRoundJumpSelect(roundCount: number): boolean {
  return roundCount > BATTLE_REPORT_ROUND_JUMP_CHIP_MAX;
}

export function battleReportRoundJumpNumbers(roundNumbers: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of roundNumbers) {
    const n = Math.trunc(raw);
    if (n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out.sort((a, b) => a - b);
}
