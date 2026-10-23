import { formatHudBadgeCount } from "@/net/hudTodoBadge";

const BADGE_SELECTOR = '[data-role="toolbar-badge"]';

/** 底栏按钮角标：叠在按钮右上，pointer-events:none，不挡点击。 */
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
    badge.textContent = "";
    button.removeAttribute("data-has-badge");
    if (titleHint) button.setAttribute("title", titleHint);
    else button.removeAttribute("title");
    return;
  }
  badge.classList.remove("hidden");
  badge.textContent = text;
  button.setAttribute("data-has-badge", "1");
  if (titleHint) button.setAttribute("title", titleHint);
}

export function toolbarButtonLabel(button: HTMLElement | null): string {
  if (!button) return "";
  const label = button.querySelector<HTMLElement>(".toolbar-btn-label");
  return (label?.textContent ?? button.textContent ?? "").trim();
}
