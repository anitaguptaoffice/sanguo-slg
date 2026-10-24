import type { ResourceWallet } from "@/net/bootstrapSession";
import type { BagStack } from "@/net/bagState";
import { formatPanelGatewayErrorFromUnknown } from "@/net/contentFormValidation";
import { itemLabel } from "@/net/contentFormat";
import { HERO_ATTRIBUTE_ROWS, HERO_RECRUIT_SCROLL_ID, type HeroAttributes } from "@/net/heroMailState";

export type HotelRecruitCandidate = {
  candidate_id: number;
  city_id?: number;
  display_name: string;
  sex?: number;
  face_id?: number;
  level?: number;
  attributes?: HeroAttributes;
  loyalty?: number;
  gold_cost?: number;
};

export type HotelRecruitPoolMeta = {
  hotel_level?: number;
  hero_capacity?: number;
  hero_owned?: number;
};

export type HotelRecruitListPayload = HotelRecruitPoolMeta & {
  candidates?: HotelRecruitCandidate[];
};

const HOTEL_ERR_HINT: Record<string, string> = {
  "hero: hotel not built": "尚未建造客栈，无法使用招将池",
  "hero: hotel candidate not found": "该候选已离开客栈，请重新拉取列表",
  "hero: hero capacity full (office level)": "招贤馆容量已满，请升级官府或调整将领",
  "hero: insufficient gold": "金币不足，无法招入该候选",
  "hero: insufficient item": `道具不足，刷新池需要 ${itemLabel(HERO_RECRUIT_SCROLL_ID)}`,
};

/** 客栈三 RPC 网关失败：优先服务端原文映射，再回落招募域 code 摘要。 */
export function formatHotelRecruitGatewayError(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err);
  const trimmed = raw.trim();
  for (const [key, hint] of Object.entries(HOTEL_ERR_HINT)) {
    if (trimmed.includes(key)) {
      const code = err instanceof Error ? (err as Error & { code?: number }).code : undefined;
      return code != null ? `${hint} [${code}]` : hint;
    }
  }
  return formatPanelGatewayErrorFromUnknown("recruit", err);
}

export function parseHotelRecruitCandidate(row: Record<string, unknown>): HotelRecruitCandidate {
  const attrs = row.attributes as Record<string, unknown> | undefined;
  return {
    candidate_id: Number(row.candidate_id) || 0,
    city_id: row.city_id != null ? Number(row.city_id) : undefined,
    display_name: String(row.display_name ?? "").trim() || "无名将领",
    sex: row.sex != null ? Number(row.sex) : undefined,
    face_id: row.face_id != null ? Number(row.face_id) : undefined,
    level: row.level != null ? Number(row.level) : undefined,
    loyalty: row.loyalty != null ? Number(row.loyalty) : undefined,
    gold_cost: row.gold_cost != null ? Number(row.gold_cost) : undefined,
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

export function parseHotelRecruitListResponse(res: unknown): {
  candidates: HotelRecruitCandidate[];
  meta: HotelRecruitPoolMeta;
} {
  const r = (res ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(r.candidates) ? r.candidates : [];
  return {
    candidates: rows.map((row) => parseHotelRecruitCandidate(row as Record<string, unknown>)),
    meta: {
      hotel_level: r.hotel_level != null ? Number(r.hotel_level) : undefined,
      hero_capacity: r.hero_capacity != null ? Number(r.hero_capacity) : undefined,
      hero_owned: r.hero_owned != null ? Number(r.hero_owned) : undefined,
    },
  };
}

export function formatHotelCapacityLine(meta: HotelRecruitPoolMeta): string {
  const owned = meta.hero_owned ?? 0;
  const cap = meta.hero_capacity ?? 0;
  const hotel = meta.hotel_level ?? 0;
  if (cap > 0) {
    const full = owned >= cap;
    return `客栈 Lv${hotel} · 将领 ${owned}/${cap}${full ? "（已满）" : ""}`;
  }
  if (hotel > 0) return `客栈 Lv${hotel}`;
  return "客栈招将池（拉取后显示容量）";
}

export function formatHotelCandidateStats(c: HotelRecruitCandidate): string {
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

export function formatHotelCandidateGoldLine(c: HotelRecruitCandidate, wallet?: ResourceWallet): string {
  const cost = c.gold_cost ?? 0;
  if (cost <= 0) return "招入免费";
  const have = wallet?.gold ?? 0;
  const ok = have >= cost;
  return ok ? `招入消耗金币 ${cost}` : `金币不足（需要 ${cost}，当前 ${have}）`;
}

export function hotelRefreshItemAffordable(bag: BagStack[]): boolean {
  const stack = bag.find((s) => s.item_cfg_id === HERO_RECRUIT_SCROLL_ID);
  return (stack?.quantity ?? 0) >= 1;
}

export function formatHotelRefreshItemHint(bag: BagStack[]): string {
  const stack = bag.find((s) => s.item_cfg_id === HERO_RECRUIT_SCROLL_ID);
  const qty = stack?.quantity ?? 0;
  const label = itemLabel(HERO_RECRUIT_SCROLL_ID);
  return qty >= 1
    ? `访贤刷新消耗 ${label}×1（持有 ${qty}）`
    : `访贤刷新需要 ${label}×1（当前 ${qty}）`;
}

export function canAffordHotelCandidate(
  c: HotelRecruitCandidate | undefined,
  wallet: ResourceWallet | undefined,
  meta: HotelRecruitPoolMeta,
): { ok: boolean; reason?: string } {
  if (!c?.candidate_id) return { ok: false, reason: "请先选择客栈候选" };
  const cap = meta.hero_capacity ?? 0;
  const owned = meta.hero_owned ?? 0;
  if (cap > 0 && owned >= cap) {
    return { ok: false, reason: HOTEL_ERR_HINT["hero: hero capacity full (office level)"] };
  }
  const cost = c.gold_cost ?? 0;
  const have = wallet?.gold ?? 0;
  if (cost > 0 && have < cost) {
    return { ok: false, reason: `金币不足（需要 ${cost}，当前 ${have}）` };
  }
  return { ok: true };
}

export const HOTEL_CANDIDATE_LIST_ROLE = "hotel-candidate-list";
export const HOTEL_RECRUIT_META_ROLE = "hotel-recruit-meta";
export const HOTEL_RECRUIT_PREVIEW_ROLE = "hotel-recruit-preview";
export const HOTEL_RECRUIT_FORM_ERROR_ROLE = "hotel-recruit-form-error";
