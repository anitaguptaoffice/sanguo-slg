import type { ResourceWallet } from "@/net/bootstrapSession";
import type { BagStack } from "@/net/bagState";
import {
  formatHotelCandidateGoldLine,
  formatHotelCandidateStats,
  formatHotelCapacityLine,
  formatHotelRefreshItemHint,
  HOTEL_CANDIDATE_LIST_ROLE,
  HOTEL_RECRUIT_FORM_ERROR_ROLE,
  HOTEL_RECRUIT_META_ROLE,
  HOTEL_RECRUIT_PREVIEW_ROLE,
  type HotelRecruitCandidate,
  type HotelRecruitPoolMeta,
} from "@/net/hotelRecruitState";

export function setHotelRecruitFormError(panelRoot: ParentNode | null | undefined, message: string | null): void {
  const el = panelRoot?.querySelector(`[data-role="${HOTEL_RECRUIT_FORM_ERROR_ROLE}"]`);
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function syncHotelRecruitMeta(
  panelRoot: ParentNode | null | undefined,
  meta: HotelRecruitPoolMeta,
): void {
  const el = panelRoot?.querySelector(`[data-role="${HOTEL_RECRUIT_META_ROLE}"]`);
  if (el) el.textContent = formatHotelCapacityLine(meta);
}

export function syncHotelRecruitPreview(
  panelRoot: ParentNode | null | undefined,
  candidate: HotelRecruitCandidate | undefined,
  wallet: ResourceWallet | undefined,
  refreshHint: string,
): void {
  const el = panelRoot?.querySelector(`[data-role="${HOTEL_RECRUIT_PREVIEW_ROLE}"]`);
  if (!el) return;
  if (!candidate) {
    el.textContent = refreshHint;
    return;
  }
  const goldLine = formatHotelCandidateGoldLine(candidate, wallet);
  const stats = formatHotelCandidateStats(candidate);
  el.textContent = [candidate.display_name, stats, goldLine, refreshHint].filter(Boolean).join(" · ");
}

export function syncHotelRefreshPoolButton(
  panelRoot: ParentNode | null | undefined,
  inflight: boolean,
  bag: BagStack[],
): void {
  const btn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="refresh-hotel-pool"]');
  if (!btn) return;
  btn.disabled = inflight;
  btn.textContent = inflight ? "访贤刷新中…" : "访贤刷新池";
  btn.title = formatHotelRefreshItemHint(bag);
}

export function syncHotelListRefreshButton(panelRoot: ParentNode | null | undefined, inflight: boolean): void {
  const btn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="refresh-hotel-candidates"]');
  if (!btn) return;
  btn.disabled = inflight;
  btn.textContent = inflight ? "拉取中…" : "拉取客栈列表";
}

export function syncHotelRecruitSubmitButton(
  panelRoot: ParentNode | null | undefined,
  inflight: boolean,
  canSubmit: boolean,
): void {
  const btn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="recruit-hotel-candidate"]');
  if (!btn) return;
  btn.disabled = inflight || !canSubmit;
  btn.textContent = inflight ? "招入中…" : "招入麾下";
}

export function renderHotelCandidateList(
  panelRoot: ParentNode | null | undefined,
  candidates: HotelRecruitCandidate[],
  selectedId: number,
): void {
  const ul = panelRoot?.querySelector(`[data-role="${HOTEL_CANDIDATE_LIST_ROLE}"]`);
  if (!ul) return;
  ul.innerHTML = "";
  if (!candidates.length) {
    const empty = document.createElement("li");
    empty.className = "hotel-candidate-empty";
    empty.textContent = "（客栈暂无候选，可访贤刷新或等待自然补充）";
    ul.appendChild(empty);
    return;
  }
  for (const c of candidates) {
    const li = document.createElement("li");
    li.className = "hotel-candidate-row";
    li.dataset.candidateId = String(c.candidate_id);
    if (c.candidate_id === selectedId) li.classList.add("hotel-candidate-selected");
    const face = document.createElement("span");
    face.className = "hotel-candidate-face";
    face.setAttribute("aria-hidden", "true");
    face.textContent = c.face_id != null && c.face_id > 0 ? `脸${c.face_id}` : "将";
    const body = document.createElement("span");
    body.className = "hotel-candidate-body";
    const name = document.createElement("span");
    name.className = "hotel-candidate-name";
    name.textContent = c.display_name;
    const sub = document.createElement("span");
    sub.className = "hotel-candidate-sub";
    sub.textContent = formatHotelCandidateStats(c);
    body.append(name, sub);
    li.append(face, body);
    ul.appendChild(li);
  }
}
