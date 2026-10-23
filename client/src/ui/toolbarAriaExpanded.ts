export type ToolbarPanelOpenState = {
  military: boolean;
  reports: boolean;
  marches: boolean;
  chat: boolean;
  guild: boolean;
  rank: boolean;
  quest: boolean;
  daily: boolean;
  bag: boolean;
  shop: boolean;
  hero: boolean;
  mail: boolean;
  world: boolean;
  queue: boolean;
};

const TOGGLE_ACTION_TO_KEY: Record<string, keyof ToolbarPanelOpenState> = {
  "toggle-military": "military",
  "toggle-reports": "reports",
  "toggle-marches": "marches",
  "toggle-chat": "chat",
  "toggle-guild": "guild",
  "toggle-rank": "rank",
  "toggle-quest": "quest",
  "toggle-daily": "daily",
  "toggle-bag": "bag",
  "toggle-shop": "shop",
  "toggle-hero": "hero",
  "toggle-mail": "mail",
  "toggle-world": "world",
  "toggle-queue": "queue",
};

/** Bottom toolbar toggles: aria-expanded mirrors center/side panel open state (ART-CHROME-006). */
export function syncToolbarAriaExpanded(
  toolbar: HTMLElement | null | undefined,
  state: ToolbarPanelOpenState,
): void {
  if (!toolbar) return;
  for (const btn of toolbar.querySelectorAll<HTMLButtonElement>("button[data-action]")) {
    const action = btn.getAttribute("data-action");
    const key = action ? TOGGLE_ACTION_TO_KEY[action] : undefined;
    if (!key) continue;
    btn.setAttribute("aria-expanded", state[key] ? "true" : "false");
  }
}
