import { listOverlayFocusables } from "@/ui/overlayFocusTrap";

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
    const focusables = listOverlayFocusables(root);
    if (focusables.length === 0) {
      ev.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const activeEl = document.activeElement;
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
      const focusables = listOverlayFocusables(root);
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
