import { Routes } from "./loadProto";

const notices = new WeakMap<object, string>();
export const MAX_READ_NOTICE_LENGTH = 240;

/** Display-only metadata: never parse this text as grant status or retry instructions. */
export function rememberSuccessfulReadNotice(response: object, route: string, msg: unknown): void {
  if (route !== Routes.ListPlayerBag && route !== Routes.ListPlayerQuests) return;
  if (typeof msg !== "string") return;
  const text = msg.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, MAX_READ_NOTICE_LENGTH);
  if (text) notices.set(response, text);
}

export function renderSuccessfulReadNotice(panel: HTMLElement, response?: unknown): void {
  let notice = panel.querySelector<HTMLElement>('[data-role="server-read-notice"]');
  if (!notice) {
    notice = document.createElement("p");
    notice.dataset.role = "server-read-notice";
    notice.className = "panel-feedback";
    notice.style.overflowWrap = "anywhere";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    panel.appendChild(notice);
  }
  notice.textContent = response && typeof response === "object" ? notices.get(response) ?? "" : "";
  notice.hidden = !notice.textContent;
}
