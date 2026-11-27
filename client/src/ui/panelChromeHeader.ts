import { toggleCenterPanel } from "@/ui/centerPanelForeground";

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