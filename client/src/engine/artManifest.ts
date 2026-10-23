export type ArtScaleVariant = { scale: 1 | 2; path: string };

export type ArtAssetMeta = {
  id: string;
  kind: "sprite" | "nine_slice" | "button" | "icon" | "background";
  display_size: { w: number; h: number };
  anchor: { x: number; y: number };
  anchor_unit?: "normalized" | "pixels";
  variants?: ArtScaleVariant[];
  slot_key?: string;
  nine_slice?: { left: number; top: number; right: number; bottom: number };
  button_states?: Record<string, ArtScaleVariant[]>;
  tags?: string[];
};

export type ArtManifestV1 = {
  schema_version: number;
  pack: string;
  texture_delivery?: string;
  base_url: string;
  assets: ArtAssetMeta[];
};

export function pickScaleVariant(
  variants: ArtScaleVariant[] | undefined,
  devicePixelRatio: number,
): ArtScaleVariant | undefined {
  if (!variants?.length) return undefined;
  const want = devicePixelRatio >= 1.5 ? 2 : 1;
  return variants.find((v) => v.scale === want) ?? variants.find((v) => v.scale === 1) ?? variants[0];
}

export function joinArtBaseUrl(baseUrl: string, importMetaBase: string, relativePath: string): string {
  const packBase = baseUrl.startsWith("/") ? baseUrl : `/${baseUrl}`;
  const viteBase = importMetaBase.endsWith("/") ? importMetaBase.slice(0, -1) : importMetaBase;
  const rel = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
  const combined = `${viteBase}${packBase}`.replace(/\/{2,}/g, "/");
  const normalized = combined.endsWith("/") ? combined.slice(0, -1) : combined;
  return `${normalized}/${rel}`;
}
