import {
  COMING_HERO_FORM_ERROR_ROLE,
  COMING_HERO_LIST_ROLE,
  COMING_HERO_PREVIEW_ROLE,
  formatComingAcceptPreviewLine,
  formatComingHeroStats,
  type ComingAcceptPreview,
  type ComingHeroRow,
} from "@/net/comingHeroState";

export function setComingHeroFormError(panelRoot: ParentNode | null | undefined, message: string | null): void {
  const el = panelRoot?.querySelector(`[data-role="${COMING_HERO_FORM_ERROR_ROLE}"]`);
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function syncComingAcceptPreview(
  panelRoot: ParentNode | null | undefined,
  coming: ComingHeroRow | undefined,
  preview: ComingAcceptPreview | null | undefined,
): void {
  const el = panelRoot?.querySelector(`[data-role="${COMING_HERO_PREVIEW_ROLE}"]`);
  if (!el) return;
  el.textContent = formatComingAcceptPreviewLine(coming, preview);
}

export function syncComingListRefreshButton(panelRoot: ParentNode | null | undefined, inflight: boolean): void {
  const btn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="refresh-coming-list"]');
  if (!btn) return;
  btn.disabled = inflight;
  btn.textContent = inflight ? "拉取中…" : "拉取来投列表";
}

export function syncComingAcceptButton(
  panelRoot: ParentNode | null | undefined,
  inflight: boolean,
  tryInflight: boolean,
  canSubmit: boolean,
): void {
  const btn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="coming-accept-confirm"]');
  if (!btn) return;
  btn.disabled = inflight || tryInflight || !canSubmit;
  btn.textContent = inflight ? "接受中…" : "确认接受";
}

export function syncComingRejectButton(
  panelRoot: ParentNode | null | undefined,
  inflight: boolean,
  hasSelection: boolean,
): void {
  const btn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="coming-reject"]');
  if (!btn) return;
  btn.disabled = inflight || !hasSelection;
  btn.textContent = inflight ? "拒绝中…" : "拒绝来投";
}

export function renderComingHeroList(
  panelRoot: ParentNode | null | undefined,
  coming: ComingHeroRow[],
  selectedHeroId: number,
): void {
  const ul = panelRoot?.querySelector(`[data-role="${COMING_HERO_LIST_ROLE}"]`);
  if (!ul) return;
  ul.innerHTML = "";
  if (!coming.length) {
    const empty = document.createElement("li");
    empty.className = "coming-hero-empty";
    empty.textContent = "（当前城池暂无来投将领）";
    ul.appendChild(empty);
    return;
  }
  for (const c of coming) {
    const li = document.createElement("li");
    li.className = "coming-hero-row";
    li.dataset.comingId = String(c.hero_id);
    if (c.hero_id === selectedHeroId) li.classList.add("coming-hero-selected");
    const name = document.createElement("span");
    name.className = "coming-hero-name";
    name.textContent = c.display_name;
    const sub = document.createElement("span");
    sub.className = "coming-hero-sub";
    sub.textContent = formatComingHeroStats(c);
    li.append(name, sub);
    ul.appendChild(li);
  }
}
