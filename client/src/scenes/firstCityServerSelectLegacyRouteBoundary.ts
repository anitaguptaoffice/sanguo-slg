export type FirstCityLegacyRouteBoundaryView =
  | { kind: "hidden" }
  | { kind: "notice" };

/** Loopback V2 probe boundary; distinct from outcome rows and command status text (FIRST-CITY-WIRE.md §1). */
export function resolveFirstCityLegacyRouteBoundaryView(probeVisible: boolean): FirstCityLegacyRouteBoundaryView {
  return probeVisible ? { kind: "notice" } : { kind: "hidden" };
}

export function formatFirstCityLegacyRouteBoundaryPanel(probeVisible: boolean): string {
  const view = resolveFirstCityLegacyRouteBoundaryView(probeVisible);
  if (view.kind === "hidden") return "";
  return (
    "legacy 路由边界（只读）：world.v1 CreateCity 与 world.v2 四条首城路由独立保留；" +
    "V2 失败/未知不得回落 v1 建城，登录或进入服不触发创建。Submit/Continue/Get/Discover 须在本面板显式点击。" +
    "不宣称可玩首城、真实后端产品验收、生产激活或 realm 认证。"
  );
}
