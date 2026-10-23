const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Visible, keyboard-focusable descendants inside an overlay root. */
export function listOverlayFocusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  });
}

export type OverlayFocusTrapOptions = {
  root: HTMLElement;
  /** Focus returns here on close (Esc or programmatic). */
  trigger?: HTMLElement | null;
  onClose?: () => void;
};

export type OverlayFocusTrap = {
  open(): void;
  close(): void;
  dispose(): void;
  isActive(): boolean;
};

export function createOverlayFocusTrap(options: OverlayFocusTrapOptions): OverlayFocusTrap {
  let active = false;

  const onKeyDown = (ev: KeyboardEvent) => {
    if (!active) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      close();
      return;
    }
    if (ev.key !== "Tab") return;
    const focusables = listOverlayFocusables(options.root);
    if (focusables.length === 0) {
      ev.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const activeEl = document.activeElement;
    if (ev.shiftKey) {
      if (activeEl === first || !options.root.contains(activeEl)) {
        ev.preventDefault();
        last.focus();
      }
    } else if (activeEl === last) {
      ev.preventDefault();
      first.focus();
    }
  };

  function open(): void {
    if (active) return;
    active = true;
    options.root.classList.remove("hidden");
    options.root.removeAttribute("aria-hidden");
    const focusables = listOverlayFocusables(options.root);
    const target = focusables[0] ?? options.root;
    if (target !== options.root && !target.hasAttribute("tabindex")) {
      target.focus();
    } else if (focusables[0]) {
      focusables[0].focus();
    }
    document.addEventListener("keydown", onKeyDown, true);
  }

  function close(): void {
    if (!active) return;
    active = false;
    options.root.classList.add("hidden");
    options.root.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", onKeyDown, true);
    options.trigger?.focus();
    options.onClose?.();
  }

  function dispose(): void {
    document.removeEventListener("keydown", onKeyDown, true);
    active = false;
  }

  return { open, close, dispose, isActive: () => active };
}
