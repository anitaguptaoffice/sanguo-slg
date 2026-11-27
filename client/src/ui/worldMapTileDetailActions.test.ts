import { describe, expect, it } from "vitest";
import {
  buildWorldMapTileActionSpecs,
  worldMapActionDataAction,
} from "@/ui/worldMapTileDetailActions";

describe("worldMapTileDetailActions", () => {
  it("maps huangjin actions to primary attack and scout secondary", () => {
    const { primary, secondary } = buildWorldMapTileActionSpecs(
      ["查看详情", "讨伐掠夺"],
      { npcHuangjin: true },
    );
    expect(primary.kind).toBe("march-attack");
    expect(primary.marchPurpose).toBe(1);
    expect(secondary.some((s) => s.kind === "march-scout")).toBe(true);
    expect(worldMapActionDataAction(primary.kind)).toBe("world-map-march");
  });

  it("prefers occupy over loot for wild tiles", () => {
    const { primary } = buildWorldMapTileActionSpecs(["查看详情", "占领", "掠夺"]);
    expect(primary.kind).toBe("march-occupy");
    expect(primary.marchPurpose).toBe(4);
  });

  it("includes gather as secondary when advertised", () => {
    const { secondary } = buildWorldMapTileActionSpecs(["查看详情", "派遣驻军", "采集寻宝", "放弃野地"]);
    expect(secondary.some((s) => s.kind === "open-world-gather")).toBe(true);
    expect(worldMapActionDataAction("open-world-gather")).toBe("world-map-open-world");
  });
});