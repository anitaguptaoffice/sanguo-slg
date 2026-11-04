import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarchListPanel } from "./MarchListPanel";
import { WORLD_MAP_EDGE } from "./worldMinimap";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
async function setup() {
  const mount = document.createElement("div"), status = vi.fn();
  const marches = [[0, 0], [5, 8], [WORLD_MAP_EDGE - 1, WORLD_MAP_EDGE - 1]].map(([x, y], i) => ({ march_id: i + 1, to_x: x, to_y: y, phase: 2, purpose: 1 }));
  const gateway = { listMarches: vi.fn().mockResolvedValue({ marches, total: marches.length }) };
  const panel = new MarchListPanel(mount, gateway as never, () => 1, status, { getWorldSelectedGrid: () => ({ x: 5, y: 8 }) });
  panel.attach(); panel.toggle(); await flush();
  const x = mount.querySelector<HTMLInputElement>('[data-field="filter-to-x"]')!, y = mount.querySelector<HTMLInputElement>('[data-field="filter-to-y"]')!;
  const apply = (a: string, b: string) => { x.value = a; y.value = b; mount.querySelector<HTMLButtonElement>('[data-action="apply-march-dest-filter"]')!.click(); };
  const ids = () => [...mount.querySelectorAll('[data-march-id]')].filter((el) => el.tagName === "LI").map((el) => el.getAttribute("data-march-id"));
  return { panel, mount, status, gateway, apply, ids, x, y };
}
beforeEach(() => sessionStorage.clear());
describe("manual march destination filter", () => {
  it.each([["", ""], ["", "8"], ["5", ""], ["5.5", "8"]])("invalid inputs %s,%s preserve current filter", async (x, y) => {
    const s = await setup(); s.panel.setDestFilter(5, 8); s.status.mockClear();
    try {
      s.apply(x, y); expect(s.panel.getDestFilter()).toEqual({ x: 5, y: 8 }); expect(s.ids()).toEqual(["2"]);
      expect(s.status).toHaveBeenCalledWith(expect.stringContaining("坐标"));
      expect(s.x.value).toBe(x); expect(s.y.value).toBe(y); expect(s.gateway.listMarches).toHaveBeenCalledTimes(1);
    } finally { s.panel.detach(); }
  });
  it.each([["-1", "8"], ["5", "-1"], [String(WORLD_MAP_EDGE), "8"], ["5", String(WORLD_MAP_EDGE)], ["5", "8.5"], ["1e99", "8"]])("out-of-map input %s,%s is rejected", async (x, y) => {
    const s = await setup(); s.panel.setDestFilter(5, 8); s.status.mockClear();
    try { s.apply(x, y); expect(s.panel.getDestFilter()).toEqual({ x: 5, y: 8 }); expect(s.ids()).toEqual(["2"]); expect(s.status).toHaveBeenCalled(); }
    finally { s.panel.detach(); }
  });
  it.each([[0, 0, "1"], [5, 8, "2"], [WORLD_MAP_EDGE - 1, WORLD_MAP_EDGE - 1, "3"]])("valid %s,%s selects the exact grid", async (x, y, id) => {
    const s = await setup(); s.panel.setDestFilterMode("manual"); s.status.mockClear();
    try {
      s.apply(String(x), String(y)); expect(s.panel.getDestFilter()).toEqual({ x, y }); expect(s.ids()).toEqual([id]);
      expect(s.status).not.toHaveBeenCalled(); expect(s.gateway.listMarches).toHaveBeenCalledTimes(1);
    } finally { s.panel.detach(); }
  });
  it("empty first apply keeps all marches instead of silently selecting origin", async () => {
    const s = await setup(); s.panel.setDestFilterMode("manual");
    try { s.apply("", ""); expect(s.panel.getDestFilter()).toBeNull(); expect(s.ids()).toEqual(["1", "2", "3"]); }
    finally { s.panel.detach(); }
  });
  it("all and world modes continue working after invalid and valid manual input", async () => {
    const s = await setup();
    try {
      s.panel.setDestFilterMode("world"); expect(s.panel.getDestFilter()).toEqual({ x: 5, y: 8 });
      s.panel.setDestFilterMode("manual"); s.apply("", "8"); expect(s.panel.getDestFilter()).toBeNull();
      s.apply("0", "0"); expect(s.ids()).toEqual(["1"]);
      s.panel.setDestFilterMode("all"); expect(s.panel.getDestFilter()).toBeNull(); expect(s.ids()).toEqual(["1", "2", "3"]);
      s.panel.setDestFilterMode("world"); expect(s.ids()).toEqual(["2"]);
    } finally { s.panel.detach(); }
  });

});
