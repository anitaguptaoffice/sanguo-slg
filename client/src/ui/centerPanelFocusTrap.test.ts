import { describe, expect, it } from "vitest";
import { createCenterPanelFocusTrap } from "@/ui/centerPanelFocusTrap";

describe("centerPanelFocusTrap (CLIENT-135)", () => {
  it("traps Tab and restores toolbar trigger on Escape", () => {
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.textContent = "队列";
    document.body.append(trigger);

    const root = document.createElement("div");
    root.innerHTML = `<button type="button" id="a">one</button><button type="button" id="b">two</button>`;
    document.body.append(root);

    let closed = false;
    const trap = createCenterPanelFocusTrap(root, () => {
      closed = true;
      root.classList.add("hidden");
    });

    trap.setOpen(true, trigger);
    expect(document.activeElement?.id).toBe("a");

    const last = root.querySelector<HTMLButtonElement>("#b")!;
    last.focus();
    last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement?.id).toBe("a");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(closed).toBe(true);
    expect(document.activeElement).toBe(trigger);

    trap.dispose();
    trigger.remove();
    root.remove();
  });
});
