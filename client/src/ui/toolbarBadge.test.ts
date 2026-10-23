import { describe, expect, it } from "vitest";
import { setToolbarBadge, toolbarButtonLabel } from "@/ui/toolbarBadge";

describe("toolbarBadge", () => {
  it("renders non-interactive badge overlay", () => {
    const btn = document.createElement("button");
    btn.innerHTML = '<span class="toolbar-btn-label">邮件</span>';
    setToolbarBadge(btn, 3, "邮件 · 3 封未读");
    const badge = btn.querySelector('[data-role="toolbar-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe("3");
    expect((badge as HTMLElement).classList.contains("hidden")).toBe(false);
    expect(badge?.classList.contains("toolbar-badge")).toBe(true);
    expect(toolbarButtonLabel(btn)).toBe("邮件");
    setToolbarBadge(btn, 0);
    expect(btn.querySelector('[data-role="toolbar-badge"]')?.classList.contains("hidden")).toBe(true);
  });
});
