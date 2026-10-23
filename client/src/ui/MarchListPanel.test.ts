import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MarchListPanel } from "@/ui/MarchListPanel";

describe("MarchListPanel", () => {
  let mount: HTMLElement;

  beforeEach(() => {
    mount = document.createElement("div");
    document.body.appendChild(mount);
  });

  afterEach(() => {
    mount.remove();
  });

  it("shows empty list hint and calls listMarches on open", async () => {
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({ marches: [], total: 0 }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 42, () => {});
    panel.attach();
    panel.toggle();

    await vi.waitFor(() => {
      expect(gateway.listMarches).toHaveBeenCalledWith(42, 20, 0);
    });

    const li = mount.querySelector(".march-list li");
    expect(li?.textContent).toContain("暂无行军");
  });

  it("renders march rows with purpose and phase", async () => {
    const gateway = {
      listMarches: vi.fn().mockResolvedValue({
        marches: [
          {
            march_id: 7,
            purpose: 1,
            phase: 2,
            from_x: 1,
            from_y: 2,
            to_x: 5,
            to_y: 5,
            depart_at_ms: Date.UTC(2024, 0, 1, 8, 0, 0),
            arrive_at_ms: Date.UTC(2024, 0, 1, 9, 0, 0),
          },
        ],
        total: 1,
      }),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => undefined, () => {});
    panel.attach();
    panel.toggle();

    await vi.waitFor(() => {
      expect(mount.querySelectorAll(".march-list li").length).toBe(1);
    });

    const text = mount.querySelector(".march-list li")?.textContent ?? "";
    expect(text).toContain("攻击");
    expect(text).toContain("行军中");
    expect(text).toContain("(1,2)");
    expect(text).toContain("(5,5)");
  });

  it("shows error when listMarches fails", async () => {
    const gateway = {
      listMarches: vi.fn().mockRejectedValue(new Error("网关超时")),
    };
    const panel = new MarchListPanel(mount, gateway as never, () => 1, () => {});
    panel.attach();
    panel.toggle();

    await vi.waitFor(() => {
      expect(mount.querySelector('[data-role="march-list-status"]')?.textContent).toContain("加载失败");
    });
  });
});
