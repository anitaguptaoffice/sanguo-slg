import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ArtAssetMeta, ArtManifestV1 } from "./artManifest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../public/assets/art/v1");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as ArtManifestV1;
const expected = Array.from({ length: 49 }, (_, i) => `item.icon.${2001 + i}.v1`);
function validate(items: ArtAssetMeta[]) {
  expect(items.map((a) => a.id).sort()).toEqual(expected);
  for (const a of items) {
    const id = a.id.split(".")[2];
    expect(a.kind).toBe("icon");
    expect(a.display_size).toEqual({ w: 64, h: 64 });
    expect(a.anchor).toEqual({ x: 32, y: 32 });
    expect(a.anchor_unit).toBe("pixels");
    expect(a.variants).toEqual([1, 2].map((scale) => ({ scale, path: `textures/${scale}x/items/${id}.png` })));
  }
}
const fixture = (): ArtAssetMeta[] => expected.map((id) => ({
  id, kind: "icon", display_size: { w: 64, h: 64 }, anchor: { x: 32, y: 32 }, anchor_unit: "pixels",
  variants: [1, 2].map((scale) => ({ scale: scale as 1 | 2, path: `textures/${scale}x/items/${id.split(".")[2]}.png` })),
}));
describe("original item production inventory", () => {
  it("preserves 139 non-item entries and accepts only absent or complete item delivery", () => {
    const assets = manifest.assets;
    expect(new Set(assets.map((a) => a.id)).size).toBe(assets.length);
    expect(assets.filter((a) => !a.id.startsWith("item.icon."))).toHaveLength(139);
    const items = assets.filter((a) => a.id.startsWith("item.icon."));
    if (items.length) validate(items);
    for (const a of items) for (const v of a.variants ?? []) expect(existsSync(join(root, v.path))).toBe(true);
  });
  it("accepts the exact independent item metadata contract", () => validate(fixture()));
  it.each(["missing", "extra", "duplicate", "kind", "size", "anchor", "path"])("rejects %s corruption", (mode) => {
    const assets = fixture();
    if (mode === "missing") assets.pop();
    if (mode === "extra") assets.push({ ...assets[0], id: "item.icon.2050.v1" });
    if (mode === "duplicate") assets[1] = assets[0];
    if (mode === "kind") assets[0].kind = "sprite";
    if (mode === "size") assets[0].display_size.w = 20;
    if (mode === "anchor") assets[0].anchor = { x: 0, y: 0 };
    if (mode === "path") assets[0].variants![0].path = "wrong.png";
    expect(() => validate(assets)).toThrow();
  });
});
