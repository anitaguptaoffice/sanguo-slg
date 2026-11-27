/** 底部工具栏「更多」二级收纳（真机 HUD 止血）。 */

export const TOOLBAR_MORE_DRAWER_SELECTOR = '[data-role="toolbar-more-drawer"]';

export function syncToolbarMoreDrawer(
  toolbar: HTMLElement | null | undefined,
  open: boolean,
): void {
  if (!toolbar) return;
  const drawer = toolbar.querySelector<HTMLElement>(TOOLBAR_MORE_DRAWER_SELECTOR);
  const toggle = toolbar.querySelector<HTMLButtonElement>('[data-action="toggle-toolbar-more"]');
  if (!drawer || !toggle) return;
  drawer.classList.toggle("hidden", !open);
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
}

export function isToolbarMoreDrawerOpen(toolbar: HTMLElement | null | undefined): boolean {
  const drawer = toolbar?.querySelector<HTMLElement>(TOOLBAR_MORE_DRAWER_SELECTOR);
  return drawer != null && !drawer.classList.contains("hidden");
}