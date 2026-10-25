import type { ResourceWallet } from "@/net/bootstrapSession";
import type { BagStack } from "@/net/bagState";
import {
  CAPTIVE_HERO_FORM_ERROR_ROLE,
  CAPTIVE_HERO_LIST_ROLE,
  CAPTIVE_HERO_PREVIEW_ROLE,
  formatCaptiveHeroStats,
  formatCaptiveSummonPreviewLine,
  type CaptiveHeroRow,
  type CaptiveSummonPreview,
} from "@/net/captiveHeroState";

export function setCaptiveHeroFormError(panelRoot: ParentNode | null | undefined, message: string | null): void {
  const el = panelRoot?.querySelector(`[data-role="${CAPTIVE_HERO_FORM_ERROR_ROLE}"]`);
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function syncCaptiveSummonPreview(
  panelRoot: ParentNode | null | undefined,
  captive: CaptiveHeroRow | undefined,
  preview: CaptiveSummonPreview | null | undefined,
  wallet: ResourceWallet | undefined,
  bag: BagStack[],
): void {
  const el = panelRoot?.querySelector(`[data-role="${CAPTIVE_HERO_PREVIEW_ROLE}"]`);
  if (!el) return;
  el.textContent = formatCaptiveSummonPreviewLine(captive, preview, wallet, bag);
}

export function syncCaptiveListRefreshButton(panelRoot: ParentNode | null | undefined, inflight: boolean): void {
  const btn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="refresh-captive-list"]');
  if (!btn) return;
  btn.disabled = inflight;
  btn.textContent = inflight ? "拉取中…" : "拉取俘虏列表";
}

export function syncCaptiveSummonButton(
  panelRoot: ParentNode | null | undefined,
  inflight: boolean,
  tryInflight: boolean,
  canSubmit: boolean,
): void {
  const btn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="captive-summon-confirm"]');
  if (!btn) return;
  btn.disabled = inflight || tryInflight || !canSubmit;
  btn.textContent = inflight ? "招降中…" : "确认招降";
}

export function syncCaptiveReleaseButton(
  panelRoot: ParentNode | null | undefined,
  inflight: boolean,
  hasSelection: boolean,
): void {
  const btn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="captive-release"]');
  if (!btn) return;
  btn.disabled = inflight || !hasSelection;
  btn.textContent = inflight ? "释放中…" : "释放俘虏";
}

export function renderCaptiveHeroList(
  panelRoot: ParentNode | null | undefined,
  captives: CaptiveHeroRow[],
  selectedHeroId: number,
): void {
  const ul = panelRoot?.querySelector(`[data-role="${CAPTIVE_HERO_LIST_ROLE}"]`);
  if (!ul) return;
  ul.innerHTML = "";
  if (!captives.length) {
    const empty = document.createElement("li");
    empty.className = "captive-hero-empty";
    empty.textContent = "（当前城池暂无俘虏）";
    ul.appendChild(empty);
    return;
  }
  for (const c of captives) {
    const li = document.createElement("li");
    li.tabIndex = 0;
    li.setAttribute("role", "button");
    li.setAttribute("aria-pressed", String(c.hero_id === selectedHeroId));
    li.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault(); li.click();
        ul.querySelector<HTMLElement>(`[data-captive-id="${c.hero_id}"]`)?.focus();
      }
    });
    li.className = "captive-hero-row";
    li.dataset.captiveId = String(c.hero_id);
    if (c.hero_id === selectedHeroId) li.classList.add("captive-hero-selected");
    const name = document.createElement("span");
    name.className = "captive-hero-name";
    name.textContent = c.display_name;
    const sub = document.createElement("span");
    sub.className = "captive-hero-sub";
    sub.textContent = formatCaptiveHeroStats(c);
    li.append(name, sub);
    ul.appendChild(li);
  }
}
