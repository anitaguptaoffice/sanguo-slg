import type { ResourceWallet } from "@/net/bootstrapSession";
import type { BagStack } from "@/net/bagState";
import {
  canRunPersuadePrimary,
  formatPersuadeFriendLine,
  formatPersuadePreview,
  formatPersuadeStateLabel,
  PERSUADE_FORM_ERROR_ROLE,
  PERSUADE_META_ROLE,
  PERSUADE_PREVIEW_ROLE,
  PERSUADE_TARGET_LIST_ROLE,
  resolvePersuadePrimaryAction,
  type PersuadeTarget,
} from "@/net/persuadeState";

export function setPersuadeFormError(panelRoot: ParentNode | null | undefined, message: string | null): void {
  const el = panelRoot?.querySelector(`[data-role="${PERSUADE_FORM_ERROR_ROLE}"]`);
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function syncPersuadeMeta(panelRoot: ParentNode | null | undefined, count: number): void {
  const el = panelRoot?.querySelector(`[data-role="${PERSUADE_META_ROLE}"]`);
  if (el) {
    el.textContent =
      count > 0 ? `名将结交 ${count} 名可结交目标` : "名将结交（拉取后显示目标列表）";
  }
}

export function syncPersuadePreview(
  panelRoot: ParentNode | null | undefined,
  target: PersuadeTarget | undefined,
  wallet: ResourceWallet | undefined,
  bag: BagStack[],
  nowMs = Date.now(),
): void {
  const el = panelRoot?.querySelector(`[data-role="${PERSUADE_PREVIEW_ROLE}"]`);
  if (el) el.textContent = formatPersuadePreview(target, wallet, bag, nowMs);
}

export function syncPersuadeListRefreshButton(panelRoot: ParentNode | null | undefined, inflight: boolean): void {
  const btn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="refresh-persuade-targets"]');
  if (!btn) return;
  btn.disabled = inflight;
  btn.textContent = inflight ? "拉取中…" : "拉取结交目标";
}

export function syncPersuadePrimaryButton(
  panelRoot: ParentNode | null | undefined,
  inflight: boolean,
  target: PersuadeTarget | undefined,
  wallet: ResourceWallet | undefined,
  bag: BagStack[],
  nowMs = Date.now(),
): void {
  const btn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="persuade-primary"]');
  if (!btn) return;
  const action = resolvePersuadePrimaryAction(target);
  const gate = canRunPersuadePrimary(target, wallet, bag, nowMs);
  const label =
    action === "befriend"
      ? "名将结交"
      : action === "persuade"
        ? "游说一次"
        : action === "hire"
          ? "达标招入"
          : action === "done"
            ? "已招入"
            : "结交/游说";
  btn.disabled = inflight || !gate.ok || action === "done" || action === "none";
  btn.textContent = inflight ? "提交中…" : label;
  btn.title = gate.reason ?? label;
}

export function renderPersuadeTargetList(
  panelRoot: ParentNode | null | undefined,
  targets: PersuadeTarget[],
  selectedId: number,
): void {
  const ul = panelRoot?.querySelector(`[data-role="${PERSUADE_TARGET_LIST_ROLE}"]`);
  if (!ul) return;
  ul.innerHTML = "";
  if (!targets.length) {
    const empty = document.createElement("li");
    empty.className = "persuade-target-empty";
    empty.textContent = "（暂无可结交名将，请稍后拉取列表）";
    ul.appendChild(empty);
    return;
  }
  for (const t of targets) {
    const li = document.createElement("li");
    li.className = "persuade-target-row hotel-candidate-row";
    li.dataset.npcCfgId = String(t.npc_cfg_id);
    if (t.npc_cfg_id === selectedId) li.classList.add("hotel-candidate-selected");
    const face = document.createElement("span");
    face.className = "hotel-candidate-face";
    face.setAttribute("aria-hidden", "true");
    face.textContent = "将";
    const body = document.createElement("span");
    body.className = "hotel-candidate-body";
    const name = document.createElement("span");
    name.className = "hotel-candidate-name";
    name.textContent = t.display_name;
    const sub = document.createElement("span");
    sub.className = "hotel-candidate-sub";
    const lv = t.level != null ? `Lv${t.level} · ` : "";
    sub.textContent = `${lv}${formatPersuadeStateLabel(t.state)} · ${formatPersuadeFriendLine(t)}`;
    body.append(name, sub);
    li.append(face, body);
    ul.appendChild(li);
  }
}
