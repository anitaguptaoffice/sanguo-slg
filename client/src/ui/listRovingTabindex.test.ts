import { describe, expect, it, vi } from "vitest";
import {
  handleListRovingKeyDown,
  syncListRovingTabindex,
} from "@/ui/listRovingTabindex";

describe("listRovingTabindex (CLIENT-135)", () => {
  it("syncListRovingTabindex sets first item tabindex 0", () => {
    const ul = document.createElement("ul");
    ul.innerHTML = `<li data-id="1">a</li><li data-id="2">b</li>`;
    syncListRovingTabindex(ul, "li[data-id]");
    const items = ul.querySelectorAll("li");
    expect(items[0].tabIndex).toBe(0);
    expect(items[1].tabIndex).toBe(-1);
  });

  it("ArrowDown moves focus and calls onActivate", () => {
    const panel = document.createElement("div");
    panel.dataset.centerPanel = "hero";
    const ul = document.createElement("ul");
    ul.innerHTML = `<li data-hero-id="1" tabindex="0">a</li><li data-hero-id="2" tabindex="-1">b</li>`;
    panel.append(ul);
    document.body.append(panel);

    const onActivate = vi.fn();
    ul.querySelector("li")!.focus();
    const handled = handleListRovingKeyDown(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      ul,
      { itemSelector: "li[data-hero-id]", onActivate },
    );
    expect(handled).toBe(true);
    expect(document.activeElement?.getAttribute("data-hero-id")).toBe("2");
    expect(onActivate).toHaveBeenCalledOnce();

    panel.remove();
  });
});
