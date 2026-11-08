import { listOverlayFocusables } from "@/ui/overlayFocusTrap";

function radio(el: HTMLElement): el is HTMLInputElement {
  return el instanceof HTMLInputElement && el.type === "radio";
}

/** Center-panel boundaries only: native radio groups contribute one sequential stop. */
export function listCenterPanelFocusables(root: HTMLElement, backward = false): HTMLElement[] {
  const candidates = listOverlayFocusables(root).filter(el => {
    if (!radio(el)) return true;
    if (el.tabIndex < 0 || el.matches(":disabled")) return false;
    for (let node: HTMLElement | null = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (node.hidden || node.inert || style.display === "none") return false;
      if (node instanceof HTMLDetailsElement && !node.open &&
          !node.querySelector(":scope > summary")?.contains(el)) return false;
    }
    return true;
  });
  const scope = root.getRootNode() as Document | ShadowRoot;
  const active = scope.activeElement;
  return candidates.filter(el => {
    if (!radio(el) || !el.name) return true;
    const group = candidates.filter((other): other is HTMLInputElement => radio(other) &&
      other.name === el.name && other.form === el.form && other.getRootNode() === el.getRootNode());
    // A clicked/programmatically focused sibling is the current exit point, even if unchecked.
    const focused = group.find(member => member === active);
    const stop = focused ?? group.find(member => member.checked) ?? (backward ? group.at(-1) : group[0]);
    return el === stop;
  });
}

export type CenterPanelFocusTrap = {
  /** Panel opened: trap Tab and listen for Escape. */
  setOpen(open: boolean, trigger?: HTMLElement | null, restoreFocusOnClose?: boolean): void;
  dispose(): void;
  isActive(): boolean;
};

/** Tab cycle + Esc inside a center/side panel (CLIENT-110 overlay rules, no dialog role). */
export function createCenterPanelFocusTrap(
  root: HTMLElement,
  onEscape: () => void,
): CenterPanelFocusTrap {
  let active = false;
  let trigger: HTMLElement | null = null;
  let restoreFocus = true;

  const onKeyDown = (ev: KeyboardEvent) => {
    if (!active) return;
    if (root.classList.contains("hidden")) {
      setOpen(false, null, false);
      return;
    }
    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      setOpen(false, null, true);
      onEscape();
      return;
    }
    if (ev.key !== "Tab") return;
    const focusables = listCenterPanelFocusables(root, ev.shiftKey);
    if (focusables.length === 0) {
      ev.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const activeEl = (root.getRootNode() as Document | ShadowRoot).activeElement;
    if (ev.shiftKey) {
      if (activeEl === first || !root.contains(activeEl)) {
        ev.preventDefault();
        last.focus();
      }
    } else if (activeEl === last) {
      ev.preventDefault();
      first.focus();
    }
  };

  function setOpen(open: boolean, trig?: HTMLElement | null, restoreFocusOnClose = true): void {
    if (open) {
      if (root.classList.contains("hidden")) return;
      if (trig !== undefined) trigger = trig;
      restoreFocus = restoreFocusOnClose;
      if (!active) {
        active = true;
        document.addEventListener("keydown", onKeyDown, true);
      }
      const focusables = listCenterPanelFocusables(root);
      focusables[0]?.focus();
      return;
    }
    if (!active) return;
    active = false;
    document.removeEventListener("keydown", onKeyDown, true);
    if (restoreFocusOnClose && restoreFocus) trigger?.focus();
    trigger = null;
  }

  const suspend = () => setOpen(false, null, false);
  root.addEventListener("center-panel-suspend", suspend);

  function dispose(): void {
    root.removeEventListener("center-panel-suspend", suspend);
    document.removeEventListener("keydown", onKeyDown, true);
    active = false;
    trigger = null;
  }

  return { setOpen, dispose, isActive: () => active };
}
