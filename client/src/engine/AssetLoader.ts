export type PlaceholderAsset = { id: string; color: string; label: string };

const PLACEHOLDERS: PlaceholderAsset[] = [
  { id: "bg_maincity", color: "#3d5c3a", label: "主城" },
  { id: "ui_panel", color: "#5c4a32", label: "面板" },
  { id: "icon_food", color: "#8b6914", label: "粮" },
];

/** 占位资源加载：后续替换为 Cocos Creator 资源管线。 */
export class AssetLoader {
  private cache = new Map<string, PlaceholderAsset>();

  async loadAll(): Promise<void> {
    await new Promise((r) => setTimeout(r, 120));
    for (const a of PLACEHOLDERS) this.cache.set(a.id, a);
  }

  get(id: string): PlaceholderAsset | undefined {
    return this.cache.get(id);
  }
}
