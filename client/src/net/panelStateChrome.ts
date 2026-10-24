/** CLIENT-129 兼容：面板 loading/empty/error 文案与 markup（无 manifest 时回退纯文案）。 */

export type PanelStatePhase = "loading" | "empty" | "error";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function panelStateChromeMessage(phase: PanelStatePhase, custom?: string): string {
  if (custom?.trim()) return custom.trim();
  switch (phase) {
    case "loading":
      return "加载中…";
    case "empty":
      return "暂无内容";
    case "error":
      return "加载失败";
    default:
      return "";
  }
}

export function renderPanelStateChromeMarkup(
  phase: PanelStatePhase,
  message?: string,
  extraClass = "",
): string {
  const text = panelStateChromeMessage(phase, message);
  const role = phase === "error" ? "alert" : "status";
  const errClass = phase === "error" ? " is-error" : "";
  const classes = ["panel-state-chrome", `panel-state-${phase}`, extraClass].filter(Boolean).join(" ");
  return `<p class="${classes}${errClass}" data-role="panel-state-chrome" role="${role}">${escapeHtml(text)}</p>`;
}

export function renderHeroDetailStateLoadingMarkup(): string {
  return renderPanelStateChromeMarkup("loading", "详情加载中…", "hero-detail-empty");
}

export function renderHeroDetailStateErrorMarkup(message: string): string {
  return renderPanelStateChromeMarkup("error", message, "hero-detail-empty");
}
