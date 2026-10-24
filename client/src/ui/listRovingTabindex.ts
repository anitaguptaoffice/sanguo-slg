/** Panel root attribute: `off` disables ↑/↓ roving on bound lists (CLIENT-135). */
export const LIST_ROVING_KEYBOARD_ATTR = "data-list-roving-keyboard";

export function isListRovingKeyboardEnabled(host: HTMLElement): boolean {
  return host.getAttribute(LIST_ROVING_KEYBOARD_ATTR) !== "off";
}

function rovingItems(list: HTMLElement, itemSelector: string): HTMLElement[] {
  return Array.from(list.querySelectorAll<HTMLElement>(itemSelector)).filter(
    (el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true",
  );
}

/** After list DOM refresh: first item tabindex 0, siblings -1. */
export function syncListRovingTabindex(list: HTMLElement, itemSelector: string): void {
  const items = rovingItems(list, itemSelector);
  for (let i = 0; i < items.length; i++) {
    items[i].tabIndex = i === 0 ? 0 : -1;
  }
  if (!items.length) return;
  if (!items.some((el) => el === document.activeElement)) {
    items[0].tabIndex = 0;
  }
}

export type ListRovingKeyDownOptions = {
  itemSelector: string;
  onActivate?: (item: HTMLElement) => void;
};

/**
 * ↑/↓ roving tabindex within a list (CLIENT-094 peer).
 * Returns true when the event was handled.
 */
export function handleListRovingKeyDown(
  ev: KeyboardEvent,
  list: HTMLElement,
  options: ListRovingKeyDownOptions,
): boolean {
  if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return false;
  const items = rovingItems(list, options.itemSelector);
  if (!items.length) return false;
  const host = list.closest("[data-center-panel], .building-panel") as HTMLElement | null;
  if (host && !isListRovingKeyboardEnabled(host)) return false;

  const currentIdx = items.findIndex((el) => el === document.activeElement);
  if (currentIdx < 0 && !list.contains(document.activeElement)) return false;

  ev.preventDefault();
  const delta = ev.key === "ArrowDown" ? 1 : -1;
  const start = currentIdx >= 0 ? currentIdx : 0;
  let next = start + delta;
  if (next < 0) next = items.length - 1;
  if (next >= items.length) next = 0;
  for (const el of items) el.tabIndex = -1;
  const target = items[next];
  target.tabIndex = 0;
  target.focus();
  options.onActivate?.(target);
  return true;
}
