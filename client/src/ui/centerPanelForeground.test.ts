import { afterEach, describe, expect, it } from "vitest";
import { openCenterPanel, toggleCenterPanel, captureCenterPanelIntent } from "./centerPanelForeground";
import { MarchListPanel } from "./MarchListPanel";
import { createCenterPanelFocusTrap } from "./centerPanelFocusTrap";
afterEach(() => document.body.replaceChildren());
function fixture() {
  const mount = document.createElement("div");
  mount.innerHTML = '<button id="toolbar">open</button><div class="content-panel hidden"><input value="selected"><button>close</button></div><div class="content-panel hidden"><button>target</button></div><div role="dialog">confirm</div><div role="tooltip">hint</div>';
  document.body.append(mount);
  const [a, b] = Array.from(mount.querySelectorAll<HTMLElement>(".content-panel"));
  return { mount, a, b, trigger: mount.querySelector<HTMLButtonElement>("#toolbar")! };
}
describe("center panel presentation", () => {
  it("records late march success without replacing newer foreground", async () => {
    const { mount, a, b } = fixture();
    const marches = new MarchListPanel(mount, { listMarches: async () => ({ marches: [] }) } as never, () => 1, () => {});
    marches.attach(); openCenterPanel(a);
    const pending = captureCenterPanelIntent(a); openCenterPanel(b);
    marches.notifyMarchStarted(12, { openPanel: pending() }); await Promise.resolve();
    expect(marches.isOpen()).toBe(false); expect(b.classList.contains("hidden")).toBe(false);
    marches.detach();
  });
  it("switches only peer surfaces, retaining DOM, selection and scroll", async () => {
    const { mount, a, b } = fixture();
    openCenterPanel(a); a.scrollTop = 75;
    const input = a.querySelector("input")!; input.value = "retained";
    openCenterPanel(b); await Promise.resolve();
    expect(a.classList.contains("hidden")).toBe(true);
    expect(b.contains(document.activeElement)).toBe(true);
    expect(mount.querySelector('[role="dialog"]')?.className).toBe("");
    expect(mount.querySelector('[role="tooltip"]')?.className).toBe("");
    openCenterPanel(a);
    expect(a.querySelector("input")).toBe(input);
    expect(input.value).toBe("retained"); expect(a.scrollTop).toBe(75);
  });
  it("toggles closed and returns focus without re-opening other panels", async () => {
    const { a, trigger } = fixture(); trigger.focus();
    toggleCenterPanel(a); await Promise.resolve(); toggleCenterPanel(a);
    expect(a.classList.contains("hidden")).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });
  it("revokes pending presentation on switching away and back", () => {
    const { a, b } = fixture(); openCenterPanel(a);
    const pending = captureCenterPanelIntent(a); expect(pending()).toBe(true);
    openCenterPanel(b); openCenterPanel(a); expect(pending()).toBe(false);
    const reopened = captureCenterPanelIntent(a); toggleCenterPanel(a); expect(reopened()).toBe(false);
  });
  it("suspends old keyboard trap; late setOpen cannot steal target focus", async () => {
    const { a, b, trigger } = fixture();
    const trap = createCenterPanelFocusTrap(a, () => a.classList.add("hidden"));
    openCenterPanel(a); trap.setOpen(true, trigger); openCenterPanel(b); await Promise.resolve();
    expect(trap.isActive()).toBe(false);
    trap.setOpen(true, trigger); expect(trap.isActive()).toBe(false);
    expect(b.contains(document.activeElement)).toBe(true);
    b.querySelector("button")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(b.classList.contains("hidden")).toBe(true); trap.dispose();
  });
});
