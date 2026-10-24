import type { ResourceWallet } from "@/net/bootstrapSession";
import type { BagStack } from "@/net/bagState";
import { formatPanelGatewayErrorFromUnknown } from "@/net/contentFormValidation";
import { itemLabel } from "@/net/contentFormat";
import { HERO_RECRUIT_SCROLL_ID } from "@/net/heroMailState";

/** 与 internal/hero/persuade_npc.go PersuadeItemCfgID 对齐。 */
export const PERSUADE_ITEM_CFG_ID = HERO_RECRUIT_SCROLL_ID;

export const LIONIZE_STATE_NONE = 0;
export const LIONIZE_STATE_BEFRIENDED = 1;
export const LIONIZE_STATE_RECRUITED = 2;

export type PersuadeTarget = {
  npc_cfg_id: number;
  template_cfg_id?: number;
  display_name: string;
  level?: number;
  friend: number;
  state: number;
  hire_friend_min: number;
  next_persuade_at_ms?: number;
};

const PERSUADE_ERR_HINT: Record<string, string> = {
  "hero: persuade on cooldown": "游说冷却中，请稍后再试",
  "hero: insufficient friend for lionize hire": "友好不足，请继续游说后再招入",
  "hero: hero capacity full (office level)": "招贤馆容量已满，请升级官府或调整将领",
  "hero: insufficient item": `道具不足，游说需要 ${itemLabel(PERSUADE_ITEM_CFG_ID)}×1`,
  "hero: insufficient gold": "金币不足，无法结交该名将",
  "hero: lionize befriending required before persuade": "请先结交该名将，再游说",
  "hero: friend sufficient; call LionizeHero to recruit": "友好已达标，请使用招入",
  "hero: famous hero already recruited via lionize": "该名将已招入麾下",
  "hero: already befriended; use persuade or hire": "已结交，请游说或达标招入",
  "hero: persuade target not in M1 roster": "该名将不在可结交列表中",
};

export function formatPersuadeGatewayError(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err);
  const trimmed = raw.trim();
  for (const [key, hint] of Object.entries(PERSUADE_ERR_HINT)) {
    if (trimmed.includes(key)) {
      const code = err instanceof Error ? (err as Error & { code?: number }).code : undefined;
      return code != null ? `${hint} [${code}]` : hint;
    }
  }
  return formatPanelGatewayErrorFromUnknown("recruit", err);
}

export function parsePersuadeTarget(row: Record<string, unknown>): PersuadeTarget {
  return {
    npc_cfg_id: Number(row.npc_cfg_id) || 0,
    template_cfg_id: row.template_cfg_id != null ? Number(row.template_cfg_id) : undefined,
    display_name: String(row.display_name ?? "").trim() || "无名名将",
    level: row.level != null ? Number(row.level) : undefined,
    friend: row.friend != null ? Number(row.friend) : 0,
    state: row.state != null ? Number(row.state) : LIONIZE_STATE_NONE,
    hire_friend_min: row.hire_friend_min != null ? Number(row.hire_friend_min) : 30,
    next_persuade_at_ms:
      row.next_persuade_at_ms != null ? Number(row.next_persuade_at_ms) : undefined,
  };
}

export function parsePersuadeTargetListResponse(res: unknown): PersuadeTarget[] {
  const r = (res ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(r.targets) ? r.targets : [];
  return rows.map((row) => parsePersuadeTarget(row as Record<string, unknown>));
}

export function lionizeGoldCost(level: number | undefined): number {
  const lv = level != null && level > 0 ? level : 1;
  return lv * 500;
}

export function formatPersuadeStateLabel(state: number): string {
  if (state === LIONIZE_STATE_RECRUITED) return "已招入";
  if (state === LIONIZE_STATE_BEFRIENDED) return "已结交";
  return "未结交";
}

export function formatPersuadeFriendLine(t: PersuadeTarget): string {
  const min = t.hire_friend_min > 0 ? t.hire_friend_min : 30;
  return `友好 ${t.friend}/${min}`;
}

export function persuadeOnCooldown(t: PersuadeTarget | undefined, nowMs = Date.now()): boolean {
  const next = t?.next_persuade_at_ms ?? 0;
  return next > nowMs;
}

export function formatPersuadeCooldownHint(t: PersuadeTarget | undefined, nowMs = Date.now()): string {
  return persuadeOnCooldown(t, nowMs) ? "游说冷却中" : "";
}

export function persuadeItemAffordable(bag: BagStack[]): boolean {
  const stack = bag.find((s) => s.item_cfg_id === PERSUADE_ITEM_CFG_ID);
  return (stack?.quantity ?? 0) >= 1;
}

export function formatPersuadeItemHint(bag: BagStack[]): string {
  const stack = bag.find((s) => s.item_cfg_id === PERSUADE_ITEM_CFG_ID);
  const qty = stack?.quantity ?? 0;
  const label = itemLabel(PERSUADE_ITEM_CFG_ID);
  return qty >= 1
    ? `游说消耗 ${label}×1（持有 ${qty}）`
    : `游说需要 ${label}×1（当前 ${qty}）`;
}

export type PersuadePrimaryAction = "befriend" | "persuade" | "hire" | "done" | "none";

export function resolvePersuadePrimaryAction(t: PersuadeTarget | undefined): PersuadePrimaryAction {
  if (!t?.npc_cfg_id) return "none";
  if (t.state === LIONIZE_STATE_RECRUITED) return "done";
  if (t.state === LIONIZE_STATE_NONE) return "befriend";
  if (t.state === LIONIZE_STATE_BEFRIENDED) {
    const min = t.hire_friend_min > 0 ? t.hire_friend_min : 30;
    if (t.friend >= min) return "hire";
    return "persuade";
  }
  return "none";
}

export function canPersuadeTarget(
  t: PersuadeTarget | undefined,
  bag: BagStack[],
  nowMs = Date.now(),
): { ok: boolean; reason?: string } {
  if (!t?.npc_cfg_id) return { ok: false, reason: "请先选择结交目标" };
  if (t.state !== LIONIZE_STATE_BEFRIENDED) {
    return { ok: false, reason: PERSUADE_ERR_HINT["hero: lionize befriending required before persuade"] };
  }
  const min = t.hire_friend_min > 0 ? t.hire_friend_min : 30;
  if (t.friend >= min) {
    return { ok: false, reason: PERSUADE_ERR_HINT["hero: friend sufficient; call LionizeHero to recruit"] };
  }
  if (persuadeOnCooldown(t, nowMs)) {
    return { ok: false, reason: formatPersuadeCooldownHint(t, nowMs) };
  }
  if (!persuadeItemAffordable(bag)) {
    return { ok: false, reason: PERSUADE_ERR_HINT["hero: insufficient item"] };
  }
  return { ok: true };
}

export function canLionizeBefriend(
  t: PersuadeTarget | undefined,
  wallet: ResourceWallet | undefined,
): { ok: boolean; reason?: string } {
  if (!t?.npc_cfg_id) return { ok: false, reason: "请先选择结交目标" };
  if (t.state !== LIONIZE_STATE_NONE) {
    return { ok: false, reason: "仅未结交名将可初次结交" };
  }
  const cost = lionizeGoldCost(t.level);
  const have = wallet?.gold ?? 0;
  if (cost > 0 && have < cost) {
    return { ok: false, reason: `金币不足（结交需要 ${cost}，当前 ${have}）` };
  }
  return { ok: true };
}

export function canLionizeHire(t: PersuadeTarget | undefined): { ok: boolean; reason?: string } {
  if (!t?.npc_cfg_id) return { ok: false, reason: "请先选择结交目标" };
  if (t.state !== LIONIZE_STATE_BEFRIENDED) {
    return { ok: false, reason: PERSUADE_ERR_HINT["hero: insufficient friend for lionize hire"] };
  }
  const min = t.hire_friend_min > 0 ? t.hire_friend_min : 30;
  if (t.friend < min) {
    return { ok: false, reason: PERSUADE_ERR_HINT["hero: insufficient friend for lionize hire"] };
  }
  return { ok: true };
}

export function canRunPersuadePrimary(
  t: PersuadeTarget | undefined,
  wallet: ResourceWallet | undefined,
  bag: BagStack[],
  nowMs = Date.now(),
): { ok: boolean; reason?: string } {
  const action = resolvePersuadePrimaryAction(t);
  if (action === "done") return { ok: false, reason: PERSUADE_ERR_HINT["hero: famous hero already recruited via lionize"] };
  if (action === "befriend") return canLionizeBefriend(t, wallet);
  if (action === "persuade") return canPersuadeTarget(t, bag, nowMs);
  if (action === "hire") return canLionizeHire(t);
  return { ok: false, reason: "请先选择结交目标" };
}

export function formatPersuadePreview(
  t: PersuadeTarget | undefined,
  wallet: ResourceWallet | undefined,
  bag: BagStack[],
  nowMs = Date.now(),
): string {
  if (!t) return "拉取列表后选择名将";
  const parts = [
    t.display_name,
    t.level != null ? `Lv${t.level}` : "",
    formatPersuadeStateLabel(t.state),
    formatPersuadeFriendLine(t),
  ].filter(Boolean);
  const action = resolvePersuadePrimaryAction(t);
  if (action === "befriend") {
    const cost = lionizeGoldCost(t.level);
    parts.push(`结交消耗金币 ${cost}`);
  } else if (action === "persuade") {
    parts.push(formatPersuadeItemHint(bag));
    const cd = formatPersuadeCooldownHint(t, nowMs);
    if (cd) parts.push(cd);
  } else if (action === "hire") {
    parts.push("友好已达标，可招入麾下");
  } else if (action === "done") {
    parts.push("已招入，无需再操作");
  }
  return parts.join(" · ");
}

export const PERSUADE_TARGET_LIST_ROLE = "persuade-target-list";
export const PERSUADE_META_ROLE = "persuade-meta";
export const PERSUADE_PREVIEW_ROLE = "persuade-preview";
export const PERSUADE_FORM_ERROR_ROLE = "persuade-form-error";
