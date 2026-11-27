import { toggleCenterPanel } from "@/ui/centerPanelForeground";

/** 统一面板标题栏（深墨标题 + 右上 ×）。 */
export function productPanelHeaderHtml(
  title: string,
  opts?: { closeAction?: string; closeLabel?: string; extraActionsHtml?: string },
): string {
  const closeAction = opts?.closeAction ?? "close-panel";
  const closeLabel = opts?.closeLabel ?? `关闭${title}`;
  const extra = opts?.extraActionsHtml?.trim() ?? "";
  return `<div class="product-panel-header">
    <h3>${title}</h3>
    <div class="product-panel-header-actions">
      ${extra}
      <button type="button" class="product-panel-close" data-action="${closeAction}" aria-label="${closeLabel}">×</button>
    </div>
  </div>`;
}

/** 面板右上角关闭与头部刷新按钮（成品化 chrome）。 */
export function wireProductPanelChrome(
  panel: HTMLElement,
  opts?: { closeAction?: string; refreshAction?: string },
): void {
  const closeAction = opts?.closeAction ?? "close-panel";
  panel.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest(`[data-action="${closeAction}"]`);
    if (btn && panel.contains(btn)) {
      toggleCenterPanel(panel);
    }
  });
}