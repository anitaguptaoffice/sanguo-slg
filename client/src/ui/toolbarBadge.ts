import { formatHudBadgeCount } from "@/net/hudTodoBadge";

const BADGE_SELECTOR = '[data-role="toolbar-badge"]';

/** 底栏按钮角标：默认不挡按钮点击；有计数时可深链（CLIENT-038）。 */
export function setToolbarBadge(button: HTMLElement | null, count: number, titleHint?: string): void {
  if (!button) return;
  let badge = button.querySelector<HTMLElement>(BADGE_SELECTOR);
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "toolbar-badge hidden";
    badge.setAttribute("data-role", "toolbar-badge");
    badge.setAttribute("aria-hidden", "true");
    button.appendChild(badge);
  }
  const text = formatHudBadgeCount(count);
  if (!text) {
    badge.classList.add("hidden");
    badge.classList.remove("toolbar-badge--deeplink");
    badge.textContent = "";
    button.removeAttribute("data-has-badge");
    if (titleHint) button.setAttribute("title", titleHint);
    else button.removeAttribute("title");
    return;
  }
  badge.classList.remove("hidden");
  badge.classList.add("toolbar-badge--deeplink");
  badge.textContent = text;
  button.setAttribute("data-has-badge", "1");
  if (titleHint) button.setAttribute("title", titleHint);
}

/** 是否点在可深链的角标上（与按钮本体点击区分）。 */
export function isToolbarBadgeDeepLinkClick(ev: Event): boolean {
  const badge = (ev.target as HTMLElement | null)?.closest?.(BADGE_SELECTOR);
  return !!(
    badge &&
    !badge.classList.contains("hidden") &&
    badge.classList.contains("toolbar-badge--deeplink")
  );
}

export function toolbarButtonLabel(button: HTMLElement | null): string {
  if (!button) return "";
  const label = button.querySelector<HTMLElement>(".toolbar-btn-label");
  return (label?.textContent ?? button.textContent ?? "").trim();
}
