import { formatPanelGatewayErrorFromUnknown } from "@/net/contentFormValidation";
import { HERO_ATTRIBUTE_ROWS, type HeroAttributes } from "@/net/heroMailState";

export type ComingHeroRow = {
  hero_id: number;
  city_id: number;
  template_cfg_id?: number;
  display_name: string;
  level?: number;
  loyalty?: number;
  attributes?: HeroAttributes;
};

export type ComingAcceptPreview = {
  hero_id: number;
  summary: string;
};

const COMING_ERR_HINT: Record<string, string> = {
  "hero: hero is not coming": "该将领已不是来投状态，请刷新列表",
  "hero: coming offer not for this city": "该来投不在当前城池，请切换城池后重试",
  "hero: hero capacity full (office level)": "招贤馆容量已满，请升级官府或调整将领",
  "hero: hero not found": "将领不存在，请刷新列表",
};

export function formatComingHeroGatewayError(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err);
  const trimmed = raw.trim();
  for (const [key, hint] of Object.entries(COMING_ERR_HINT)) {
    if (trimmed.includes(key)) {
      const code = err instanceof Error ? (err as Error & { code?: number }).code : undefined;
      return code != null ? `${hint} [${code}]` : hint;
    }
  }
  return formatPanelGatewayErrorFromUnknown("recruit", err);
}

export function parseComingHeroRow(row: Record<string, unknown>): ComingHeroRow {
  const attrs = row.attributes as Record<string, unknown> | undefined;
  const heroId = Number(row.hero_id) || 0;
  const name = String(row.display_name ?? "").trim();
  return {
    hero_id: heroId,
    city_id: Number(row.city_id) || 0,
    template_cfg_id: row.template_cfg_id != null ? Number(row.template_cfg_id) : undefined,
    display_name: name || (heroId > 0 ? `将领 #${heroId}` : "无名来投"),
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

export function parseListComingHeroesResponse(res: unknown): ComingHeroRow[] {
  const r = (res ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(r.coming) ? r.coming : [];
  return rows.map((row) => parseComingHeroRow(row as Record<string, unknown>));
}

export function filterComingForCity(rows: ComingHeroRow[], cityId: number): ComingHeroRow[] {
  if (!cityId) return rows;
  return rows.filter((c) => c.city_id === cityId || c.city_id === 0);
}

export function parseTryAcceptComingResponse(res: unknown): ComingAcceptPreview {
  const r = (res ?? {}) as Record<string, unknown>;
  return {
    hero_id: Number(r.hero_id) || 0,
    summary: String(r.summary ?? "").trim(),
  };
}

export function formatComingHeroStats(c: ComingHeroRow): string {
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

export function formatComingAcceptPreviewLine(
  coming: ComingHeroRow | undefined,
  preview: ComingAcceptPreview | null | undefined,
): string {
  if (!coming?.hero_id) return "选择来投将领后可查看接受提示";
  if (!preview || preview.hero_id !== coming.hero_id) return "正在预检接受条件…";
  if (preview.summary) return preview.summary;
  return `是否接受将领${coming.display_name}加入麾下？`;
}

export function canConfirmComingAccept(
  preview: ComingAcceptPreview | null | undefined,
  heroId: number,
): { ok: boolean; reason?: string } {
  if (!heroId) return { ok: false, reason: "请先选择来投将领" };
  if (!preview || preview.hero_id !== heroId) {
    return { ok: false, reason: "请等待接受预检完成" };
  }
  return { ok: true };
}

export const COMING_HERO_LIST_ROLE = "coming-hero-list";
export const COMING_HERO_PREVIEW_ROLE = "coming-hero-preview";
export const COMING_HERO_FORM_ERROR_ROLE = "coming-hero-form-error";
