import {
  type ArtAssetMeta,
  type ArtManifestV1,
  type ArtScaleVariant,
  joinArtBaseUrl,
  pickScaleVariant,
} from "@/engine/artManifest";

export const ART_MANIFEST_URL = "assets/art/v1/manifest.json";

export type PlaceholderAsset = { id: string; color: string; label: string };

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

export function resolveArtPackUrl(relativePath: string, baseUrl = "/assets/art/v1"): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const rel = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
  return `${base}/${rel}`;
}

type LoadedImage = { img: HTMLImageElement; variant: ArtScaleVariant };

export class AssetLoader {
  private placeholderCache = new Map<string, PlaceholderAsset>();
  private manifest: ArtManifestV1 | null = null;
  private images = new Map<string, LoadedImage>();
  private devicePixelRatio = 1;
  private textureScale: 1 | 2 = 1;

  async loadAll(dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1): Promise<void> {
    this.devicePixelRatio = dpr;
    for (const a of PLACEHOLDERS) this.placeholderCache.set(a.id, a);
    await this.loadManifest();
  }

  getTextureScale(): 1 | 2 {
    return this.textureScale;
  }

  getDevicePixelRatio(): number {
    return this.devicePixelRatio;
  }

  async loadManifest(): Promise<ArtManifestV1> {
    const viteBase = import.meta.env.BASE_URL ?? "/";
    const url = joinArtBaseUrl("/assets/art/v1/", viteBase, "manifest.json");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`art manifest fetch failed: ${res.status} ${url}`);
    const json = (await res.json()) as ArtManifestV1;
    this.manifest = json;
    this.textureScale = this.devicePixelRatio >= 1.5 ? 2 : 1;
    await this.preloadManifestImages(json);
    return json;
  }

  private async preloadManifestImages(manifest: ArtManifestV1): Promise<void> {
    const viteBase = import.meta.env.BASE_URL ?? "/";
    const packBase = manifest.base_url || "/assets/art/v1/";
    const toLoad: ArtScaleVariant[] = [];
    for (const asset of manifest.assets) {
      const v = pickScaleVariant(asset.variants, this.devicePixelRatio);
      if (v) toLoad.push(v);
      if (asset.button_states) {
        for (const states of Object.values(asset.button_states)) {
          const sv = pickScaleVariant(states, this.devicePixelRatio);
          if (sv) toLoad.push(sv);
        }
      }
    }
    const seen = new Set<string>();
    const loads: Promise<void>[] = [];
    for (const variant of toLoad) {
      if (seen.has(variant.path)) continue;
      seen.add(variant.path);
      loads.push(this.loadImage(variant.path, variant, packBase, viteBase));
    }
    await Promise.all(loads);
  }

  private loadImage(
    path: string,
    variant: ArtScaleVariant,
    packBase: string,
    viteBase: string,
  ): Promise<void> {
    const key = path;
    if (this.images.has(key)) return Promise.resolve();
    const url = joinArtBaseUrl(packBase, viteBase, path);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(key, { img, variant });
        resolve();
      };
      img.onerror = () => reject(new Error(`failed to load art: ${url}`));
      img.src = url;
    });
  }

  resolveStableId(idOrLegacy: string): string {
    return PLACEHOLDER_TO_STABLE_ID[idOrLegacy] ?? idOrLegacy;
  }

  getArtMeta(assetId: string): ArtAssetMeta | undefined {
    const stable = this.resolveStableId(assetId);
    return this.manifest?.assets.find((a) => a.id === stable);
  }

  getManifest(): ArtManifestV1 | null {
    return this.manifest;
  }

  /** Image for asset at current DPR-selected variant scale. */
  getImageForAsset(assetId: string): { img: HTMLImageElement; meta: ArtAssetMeta; scale: 1 | 2 } | undefined {
    const meta = this.getArtMeta(assetId);
    if (!meta?.variants?.length) return undefined;
    const variant = pickScaleVariant(meta.variants, this.devicePixelRatio);
    if (!variant) return undefined;
    const loaded = this.images.get(variant.path);
    if (!loaded) return undefined;
    return { img: loaded.img, meta, scale: variant.scale };
  }

  getButtonImage(
    assetId: string,
    state: "normal" | "hover" | "pressed" | "disabled",
  ): { img: HTMLImageElement; scale: 1 | 2 } | undefined {
    const meta = this.getArtMeta(assetId);
    const states = meta?.button_states?.[state];
    if (!states?.length) return undefined;
    const variant = pickScaleVariant(states, this.devicePixelRatio);
    if (!variant) return undefined;
    const loaded = this.images.get(variant.path);
    if (!loaded) return undefined;
    return { img: loaded.img, scale: variant.scale };
  }

  get(id: string): PlaceholderAsset | undefined {
    return this.placeholderCache.get(id);
  }
}
