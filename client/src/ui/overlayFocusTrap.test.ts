import { describe, expect, it, vi } from "vitest";
import { createOverlayFocusTrap, listOverlayFocusables } from "@/ui/overlayFocusTrap";

describe("overlayFocusTrap", () => {
  it("lists focusable controls inside overlay root", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button">A</button><button disabled>B</button>`;
    expect(listOverlayFocusables(root).map((el) => el.textContent)).toEqual(["A"]);
  });

  it("traps Tab and restores focus to trigger on Escape", () => {
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.textContent = "open";
    document.body.append(trigger);

    const root = document.createElement("div");
    root.innerHTML = `<button type="button" id="first">one</button><button type="button" id="last">two</button>`;
    document.body.append(root);

    const trap = createOverlayFocusTrap({ root, trigger });
    trap.open();
    expect(root.classList.contains("hidden")).toBe(false);
    expect(document.activeElement?.id).toBe("first");

    const last = root.querySelector<HTMLButtonElement>("#last")!;
    last.focus();
    last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement?.id).toBe("first");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(root.classList.contains("hidden")).toBe(true);
    expect(document.activeElement).toBe(trigger);

    trap.dispose();
    trigger.remove();
    root.remove();
  });

  it("calls onClose when dismissed", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button">x</button>`;
    document.body.append(root);
    const onClose = vi.fn();
    const trap = createOverlayFocusTrap({ root, onClose });
    trap.open();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onClose).toHaveBeenCalledOnce();
    trap.dispose();
    root.remove();
  });
});
