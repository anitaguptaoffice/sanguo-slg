import { afterEach, expect, it, vi } from "vitest";
import { MarchListPanel } from "./MarchListPanel";
let panel: MarchListPanel;
afterEach(() => { panel?.detach(); document.body.replaceChildren(); sessionStorage.clear(); vi.useRealTimers(); });
it("keeps the newly started 21st march after 20 returned histories", async () => {
  vi.useFakeTimers();
  const rows = Array.from({ length: 21 }, (_, i) => ({ march_id: i + 1, phase: i === 20 ? 2 : 5, arrive_at_ms: Date.now() + 600000 }));
  const gateway = { listMarches: vi.fn(async (_city, limit, offset) => ({ marches: rows.slice(offset, offset + limit), total: rows.length })) };
  const root = document.createElement("div"); document.body.append(root);
  panel = new MarchListPanel(root, gateway as never, () => 1, () => {});
  panel.attach(); panel.toggle(); await vi.advanceTimersByTimeAsync(0);
  panel.notifyMarchStarted(21); await vi.advanceTimersByTimeAsync(0);
  expect(root.querySelector('[data-march-id="21"]')).not.toBeNull();
  expect(panel.getSelectedMarch()?.march_id).toBe(21);
});
it("retains selection and does not publish a partial/empty snapshot on page failure", async () => {
  vi.useFakeTimers();
  const row = { march_id: 21, phase: 2 };
  const gateway = { listMarches: vi.fn().mockResolvedValue({ marches: [row], total: 1 }) };
  const root = document.createElement("div"); document.body.append(root);
  const publish = vi.fn();
  panel = new MarchListPanel(root, gateway as never, () => 1, () => {}, { onMarchesUpdated: publish });
  panel.attach(); panel.toggle(); await vi.advanceTimersByTimeAsync(0);
  root.querySelector<HTMLElement>('[data-march-id="21"]')!.click(); publish.mockClear();
  gateway.listMarches.mockResolvedValueOnce({ marches: [{ march_id: 1, phase: 5 }], total: 21 }).mockRejectedValueOnce(new Error("offline"));
  root.querySelector<HTMLElement>('[data-action="refresh-marches"]')!.click(); await vi.advanceTimersByTimeAsync(0);
  expect(publish).not.toHaveBeenCalled(); expect(panel.getSelectedMarch()?.march_id).toBe(21);
  expect(root.textContent).toContain("offline");
});
