import { describe, expect, it, vi } from "vitest";
import { drawWorldMinimap } from "./drawWorldMinimap";
import { DEFAULT_MINIMAP_VIEW } from "./worldMinimap";
import type { MarchSummary } from "@/net/militaryFormat";

function render(rows: MarchSummary[], selectedMarchId?: number, sprite = false) {
  const calls = { fill: vi.fn(), fillText: vi.fn(), drawImage: vi.fn() };
  const ctx = new Proxy(calls, {
    get(target, key) {
      if (key in target) return target[key as keyof typeof target];
      if (key === "measureText") return () => ({ width: 20 });
      return () => {};
    },
  }) as unknown as CanvasRenderingContext2D;
  drawWorldMinimap(ctx, { marches: rows, selectedMarchId, view: DEFAULT_MINIMAP_VIEW,
    assets: sprite ? { getImageForAsset: () => ({ img: {} }) } as never : undefined });
  return calls;
}
const returned = { march_id: 1, phase: 5, from_x: 60, from_y: 60, to_x: 5, to_y: 5 };
describe("actual minimap rendering of returned history", () => {
  it.each([false, true])("does not render ordinary terminal/unknown destination markers, sprite=%s", sprite => {
    const terminal = render([returned, { ...returned, march_id: 2, phase: 127, to_x: 6 }], undefined, sprite);
    expect(terminal.fill).not.toHaveBeenCalled(); expect(terminal.drawImage).not.toHaveBeenCalled();
    const pending = render([returned, { ...returned, march_id: 3, phase: 1 }], undefined, sprite);
    expect(sprite ? pending.drawImage : pending.fill).toHaveBeenCalledTimes(1);
    for (const phase of [1, 2, 3, 4]) {
      const active = render([{ ...returned, phase }], undefined, sprite);
      expect(sprite ? active.drawImage : active.fill).toHaveBeenCalledTimes(1);
    }
  });
  it("keeps two explicit selected-history endpoint dots and terminal caption, not active marker", () => {
    const selected = render([returned], 1);
    expect(selected.fill).toHaveBeenCalledTimes(2);
    expect(selected.fillText.mock.calls.some(([text]) => text === "已回城")).toBe(true);
  });
});
