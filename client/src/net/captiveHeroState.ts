import type { ResourceWallet } from "@/net/bootstrapSession";
import type { BagStack } from "@/net/bagState";
import { formatPanelGatewayErrorFromUnknown } from "@/net/contentFormValidation";
import { itemLabel } from "@/net/contentFormat";
import { HERO_ATTRIBUTE_ROWS, type HeroAttributes } from "@/net/heroMailState";

/** M1 招降道具占位，与 internal/hero CaptiveSummonItemCfgID 对齐。 */
export const CAPTIVE_SUMMON_ITEM_CFG_ID = 2050;

export type CaptiveHeroRow = {
  hero_id: number;
  city_id: number;
  template_cfg_id?: number;
  display_name: string;
  level?: number;
  loyalty?: number;
  attributes?: HeroAttributes;
};

export type CaptiveSummonCostItem = {
  item_cfg_id: number;
  quantity: number;
};

export type CaptiveSummonPreview = {
  hero_id: number;
  gold_cost: number;
  items: CaptiveSummonCostItem[];
  summary: string;
};

const CAPTIVE_ERR_HINT: Record<string, string> = {
  "hero: hero is not captive": "该将领已不是俘虏，请刷新列表",
  "hero: captive not held in this city": "该俘虏不在当前城池，请切换城池后重试",
  "hero: hero capacity full (office level)": "招贤馆容量已满，请升级官府或调整将领",
  "hero: insufficient gold": "金币不足，无法完成招降",
  "hero: insufficient item": `道具不足，招降需要 ${itemLabel(CAPTIVE_SUMMON_ITEM_CFG_ID)}`,
  "hero: hero not found": "将领不存在，请刷新列表",
};

export function formatCaptiveHeroGatewayError(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err);
  const trimmed = raw.trim();
  for (const [key, hint] of Object.entries(CAPTIVE_ERR_HINT)) {
    if (trimmed.includes(key)) {
      const code = err instanceof Error ? (err as Error & { code?: number }).code : undefined;
      return code != null ? `${hint} [${code}]` : hint;
    }
  }
  return formatPanelGatewayErrorFromUnknown("recruit", err);
}

export function parseCaptiveHeroRow(row: Record<string, unknown>): CaptiveHeroRow {
  const attrs = row.attributes as Record<string, unknown> | undefined;
  const heroId = Number(row.hero_id) || 0;
  const name = String(row.display_name ?? "").trim();
  return {
    hero_id: heroId,
    city_id: Number(row.city_id) || 0,
    template_cfg_id: row.template_cfg_id != null ? Number(row.template_cfg_id) : undefined,
    display_name: name || (heroId > 0 ? `将领 #${heroId}` : "无名俘虏"),
    level: row.level != null ? Number(row.level) : undefined,
    loyalty: row.loyalty != null ? Number(row.loyalty) : undefined,
    attributes: attrs
      ? {
          force: attrs.force != null ? Number(attrs.force) : undefined,
          intel: attrs.intel != null ? Number(attrs.intel) : undefined,
          politics: attrs.politics != null ? Number(attrs.politics) : undefined,
          command: attrs.command != null ? Number(attrs.command) : undefined,
        }
      : undefined,
  };
}

export function parseListCaptiveHeroesResponse(res: unknown): CaptiveHeroRow[] {
  const r = (res ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(r.captives) ? r.captives : [];
  return rows.map((row) => parseCaptiveHeroRow(row as Record<string, unknown>));
}

export function filterCaptivesForCity(rows: CaptiveHeroRow[], cityId: number): CaptiveHeroRow[] {
  if (!cityId) return rows;
  return rows.filter((c) => c.city_id === cityId || c.city_id === 0);
}

export function parseTrySummonCaptiveResponse(res: unknown): CaptiveSummonPreview {
  const r = (res ?? {}) as Record<string, unknown>;
  const itemsRaw = Array.isArray(r.items) ? r.items : [];
  const items = itemsRaw.map((it) => {
    const row = it as Record<string, unknown>;
    return {
      item_cfg_id: Number(row.item_cfg_id) || 0,
      quantity: Number(row.quantity) || 0,
    };
  });
  return {
    hero_id: Number(r.hero_id) || 0,
    gold_cost: Number(r.gold_cost) || 0,
    items,
    summary: String(r.summary ?? "").trim(),
  };
}

export function formatCaptiveHeroStats(c: CaptiveHeroRow): string {
  const parts: string[] = [];
  if (c.level != null) parts.push(`Lv${c.level}`);
  if (c.loyalty != null) parts.push(`忠诚 ${c.loyalty}`);
  const attrBits = HERO_ATTRIBUTE_ROWS
    .map(({ key, label }) => {
      const v = c.attributes?.[key];
      return v != null && v > 0 ? `${label}${v}` : "";
    })
    .filter(Boolean);
  if (attrBits.length) parts.push(attrBits.join(" "));
  return parts.join(" · ");
}

export function formatCaptiveSummonPreviewLine(
  captive: CaptiveHeroRow | undefined,
  preview: CaptiveSummonPreview | null | undefined,
  wallet: ResourceWallet | undefined,
  bag: BagStack[],
): string {
  if (!captive?.hero_id) return "选择俘虏后可查看招降消耗";
  if (!preview || preview.hero_id !== captive.hero_id) return "正在预检招降消耗…";
  if (preview.summary) return preview.summary;
  const parts: string[] = [];
  const gold = preview.gold_cost ?? 0;
  if (gold > 0) {
    const have = wallet?.gold ?? 0;
    parts.push(have >= gold ? `金币 ${gold}` : `金币不足（需要 ${gold}，当前 ${have}）`);
  }
  for (const it of preview.items) {
    if (it.item_cfg_id <= 0 || it.quantity <= 0) continue;
    const stack = bag.find((s) => s.item_cfg_id === it.item_cfg_id);
    const have = stack?.quantity ?? 0;
    const label = itemLabel(it.item_cfg_id);
    parts.push(
      have >= it.quantity
        ? `${label}×${it.quantity}`
        : `${label}不足（需要 ${it.quantity}，当前 ${have}）`,
    );
  }
  return parts.length ? parts.join(" · ") : "招降免费";
}

export function canAffordCaptiveSummon(
  preview: CaptiveSummonPreview | null | undefined,
  wallet: ResourceWallet | undefined,
  bag: BagStack[],
): { ok: boolean; reason?: string } {
  if (!preview?.hero_id) return { ok: false, reason: "请先选择俘虏并等待预检完成" };
  const gold = preview.gold_cost ?? 0;
  const haveGold = wallet?.gold ?? 0;
  if (gold > 0 && haveGold < gold) {
    return { ok: false, reason: `金币不足（需要 ${gold}，当前 ${haveGold}）` };
  }
  for (const it of preview.items) {
    if (it.item_cfg_id <= 0 || it.quantity <= 0) continue;
    const stack = bag.find((s) => s.item_cfg_id === it.item_cfg_id);
    const have = stack?.quantity ?? 0;
    if (have < it.quantity) {
      const label = itemLabel(it.item_cfg_id);
      return { ok: false, reason: `${label}不足（需要 ${it.quantity}，当前 ${have}）` };
    }
  }
  return { ok: true };
}

export const CAPTIVE_HERO_LIST_ROLE = "captive-hero-list";
export const CAPTIVE_HERO_PREVIEW_ROLE = "captive-hero-preview";
export const CAPTIVE_HERO_FORM_ERROR_ROLE = "captive-hero-form-error";
