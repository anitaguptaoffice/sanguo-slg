import type { MainCitySession } from "./bootstrapSession";

export const PROFILE_REENTRY_HINT = "等级如未同步，请刷新页面后重新选服进入游戏";

export function positivePlayerLevel(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 2147483647 ? value : null;
}

/** Claim field4 is persisted authority, not a milestone inferred from quest rows or text. */
export function applyClaimPlayerLevel(response: unknown, getSession: () => MainCitySession | null,
  patch: (value: Partial<MainCitySession>) => void, current: () => boolean): void {
  if (!current() || !response || typeof response !== "object") return;
  const level = positivePlayerLevel((response as { player_level?: unknown }).player_level);
  const session = getSession();
  if (level === null || !session) return;
  const previous = positivePlayerLevel(session.player?.level) ?? 1;
  if (level > previous) patch({ player: { ...session.player, level } });
}
