/** DRAFT art pack — paths resolve under Vite public root. See docs/art/ and manifest schema. */
export const ART_PACK_V1_BASE = "/assets/art/v1";

export type PlaceholderAsset = { id: string; color: string; label: string };

/** Future manifest entry shape (subset of asset-manifest.schema.json). */
export type ArtScaleVariant = { scale: 1 | 2; path: string; atlas?: string; frame?: string };

export type ArtAssetMeta = {
  id: string;
  kind: "sprite" | "nine_slice" | "button" | "icon" | "background";
  display_size: { w: number; h: number };
  anchor: { x: number; y: number };
  anchor_unit?: "normalized" | "pixels";
  variants?: ArtScaleVariant[];
  slot_key?: string;
};

/** Legacy placeholder ids → stable asset_id (docs/art/id-mapping.md). */
export const PLACEHOLDER_TO_STABLE_ID: Record<string, string> = {
  bg_maincity: "mc.bg.plateau.v1",
  ui_panel: "ui.panel.default.v1",
  icon_food: "res.icon.food.v1",
};

const PLACEHOLDERS: PlaceholderAsset[] = [
  { id: "bg_maincity", color: "#3d5c3a", label: "主城" },
  { id: "ui_panel", color: "#5c4a32", label: "面板" },
  { id: "icon_food", color: "#8b6914", label: "粮" },
];

/** Join pack base + relative texture path; honors trailing slash on ART_PACK_V1_BASE only. */
export function resolveArtPackUrl(relativePath: string, baseUrl = ART_PACK_V1_BASE): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const rel = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
  return `${base}/${rel}`;
}

/**
 * 占位资源加载：当前仍返回色块占位。
 * 后续：fetch manifest（texture_delivery=standalone_png；样件批无图集），按 ArtAssetMeta 加载。
 * 样件可对齐 PR #100 分支提交先行制作，无需等 PR 合并。
 */
export class AssetLoader {
  private cache = new Map<string, PlaceholderAsset>();
  private manifest: ArtAssetMeta[] | null = null;

  async loadAll(): Promise<void> {
    await new Promise((r) => setTimeout(r, 120));
    for (const a of PLACEHOLDERS) this.cache.set(a.id, a);
    // Optional: await this.loadManifest(); — not enabled until sample art lands (ART-SAMPLE-001).
  }

  /** Resolve legacy id or stable asset_id to stable id when mapped. */
  resolveStableId(idOrLegacy: string): string {
    return PLACEHOLDER_TO_STABLE_ID[idOrLegacy] ?? idOrLegacy;
  }

  /** Stub: manifest-driven metadata (null until integration PR). */
  getArtMeta(assetId: string): ArtAssetMeta | undefined {
    const stable = this.resolveStableId(assetId);
    return this.manifest?.find((a) => a.id === stable);
  }

  get(id: string): PlaceholderAsset | undefined {
    return this.cache.get(id);
  }
}
