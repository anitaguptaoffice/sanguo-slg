import { expect, it, vi } from "vitest";
import { readMarchListSnapshot } from "./marchListSnapshot";
function gateway(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ march_id: i + 1 }));
  return { rows, listMarches: vi.fn(async (_city, limit, offset) => ({ marches: rows.slice(offset, offset + limit), total })) };
}
it.each([0, 20, 21, 101, 121, 221])("reads all %s rows with stable offsets", async total => {
  const g = gateway(total);
  expect(await readMarchListSnapshot(g as never, 7)).toEqual({ marches: g.rows, total });
  expect(g.listMarches.mock.calls.map(c => c[2])).toEqual(total <= 20 ? [0] : Array.from({ length: Math.ceil((total - 20) / 100) + 1 }, (_, i) => i ? 20 + (i - 1) * 100 : 0));
});
it("does not stop at short/empty pages whose indexed Hub rows are missing", async () => {
  const g = gateway(121); g.listMarches.mockResolvedValueOnce({ marches: [], total: 121 });
  expect((await readMarchListSnapshot(g as never, 7)).marches).toEqual(g.rows.slice(20));
});
it("fails closed on a later error or changing total", async () => {
  const g = gateway(121); g.listMarches.mockResolvedValueOnce({ marches: g.rows.slice(0, 20), total: 121 }).mockRejectedValueOnce(new Error("offline"));
  await expect(readMarchListSnapshot(g as never, 7)).rejects.toThrow("offline");
  g.listMarches.mockResolvedValueOnce({ marches: g.rows.slice(0, 20), total: 120 });
  await expect(readMarchListSnapshot(g as never, 7)).rejects.toThrow("已变化");
});
it.each([NaN, -1, 1.5, Infinity, 2147483648])("rejects malformed total %s", async total => {
  await expect(readMarchListSnapshot({ listMarches: async () => ({ total }) } as never)).rejects.toThrow("无效");
});
it("stops before requesting another page after actor or caller context changes", async () => {
  let token = "a", current = true;
  const g = { getSessionId: () => token, listMarches: vi.fn(async () => { token = "b"; return { total: 121 }; }) };
  await expect(readMarchListSnapshot(g as never)).rejects.toThrow("会话"); expect(g.listMarches).toHaveBeenCalledTimes(1);
  g.listMarches.mockImplementation(async () => { current = false; return { total: 121 }; });
  await expect(readMarchListSnapshot(g as never, 1, () => current)).rejects.toThrow("会话"); expect(g.listMarches).toHaveBeenCalledTimes(2);
});
it("retains legacy one-page responses without total", async () => {
  expect(await readMarchListSnapshot({ listMarches: async () => ({ marches: [{ march_id: 8 }] }) } as never)).toEqual({ marches: [{ march_id: 8 }], total: 1 });
});
