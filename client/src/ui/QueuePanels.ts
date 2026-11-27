import { BAG_USE_UNKNOWN, useBagItemWithAssets } from "@/net/bagUseAssets";
import { beginAssetRead, refreshQuestAssets, QUEST_ASSETS_PENDING } from "@/net/questClaimAssets";
import { mergeCityResourceWallet } from "@/net/cityResourceWallet";
import { captureActor } from "@/net/actorContext";
import { renderCurrentRecruitQueue } from "@/net/currentRecruitQueue";
import { openCenterPanel, toggleCenterPanel } from "@/ui/centerPanelForeground";
import type { CityBuilding, MainCitySession } from "@/net/bootstrapSession";
import type { GatewayPort } from "@/net/GatewayClient";
import { bagStackQuantity } from "@/net/bagState";
import {
  QUEUE_BUILD_COMPLETE_PULSE_MS,
  QUEUE_BUILD_SLOT_MUTUAL_HIGHLIGHT_CLASS,
  scheduleQueueBuildCompletePulse,
} from "@/net/buildQueueComplete";
import {
  detectRecruitQueueJustCompleted,
  QUEUE_RECRUIT_COMPLETE_PULSE_MS,
  QUEUE_RECRUIT_SLOT_MUTUAL_HIGHLIGHT_CLASS,
  RECRUIT_QUEUE_MATRIX_SLOT_KEY,
  scheduleQueueRecruitCompletePulse,
} from "@/net/recruitQueueComplete";
import {
  queueRecruitRowDomId,
  scheduleRecruitRowPulse,
} from "@/net/recruitTroopSubmitFeedback";
import { formatUseConsumableEffectSummary, gatewayErrorMessage } from "@/net/contentFeedback";
import {
  formatPanelGatewayErrorFromUnknownForList,
  renderPanelGatewayErrorListRow,
} from "@/net/panelGatewayError";
import type { DailyQuestRow } from "@/net/dailyQuestState";
import {
  DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS,
  DAILY_QUEUE_ANCHOR_HIGHLIGHT_MS,
  type DailyQueueAnchorTarget,
} from "@/net/dailyQueueAnchor";
import {
  buildingCfgIdForSlot,
  findBuildDailyQuestForBuilding,
  findTrainDailyQuestForRecruit,
  formatLinkedDailyQuestProgressSummary,
} from "@/net/dailyQuestQueueMatch";
import { buildingBySlot } from "@/net/hudFormat";
import { centerTodoScrollTargetId } from "@/net/hudCenterTodo";
import { highlightQueueRowForSlot } from "@/net/citySlotQueueLink";
import {
  applyQueueRowBuildingCfgIdDataset,
  highlightDomesticQueueRowFocusRing,
} from "@/net/domesticSlotQueueFocusRing";
import {
  QUEUE_ROW_COMPLETE_PULSE_CLASS,
  QUEUE_ROW_COMPLETE_PULSE_MS,
  QUEUE_ROW_COMPLETE_READONLY_CLASS,
  scheduleQueueRowCompletePulse,
} from "@/net/queueCompleteFocusRing";
import { queueBuildRowDomId } from "@/net/mainCitySlotUpgrade";
import { resetQueuePanelViewportScroll } from "@/ui/queuePanelScroll";
import { buildBuildQueueSlotMatrix } from "@/net/buildQueueMatrix";
import {
  appendQueueRemainingProgressRow,
  inferBuildUpgradeStartedAtMs,
  inferRecruitQueueStartedAtMs,
} from "@/net/queueRemainingProgress";
import {
  activeBuildingUpgrades,
  formatBuildingUpgradeQueueLine,
  formatQueuePanelOverviewBar,
  formatRecruitQueueLine,
  isRecruitQueueActive,
  mergeRecruitQueue,
  pruneFinishedRecruits,
  sortBuildQueueRows,
  type RecruitQueueEntry,
} from "@/net/queueState";
import { createCenterPanelFocusTrap, type CenterPanelFocusTrap } from "@/ui/centerPanelFocusTrap";
import { TODO_SCROLL_TARGET_ATTR, scrollCenterTodoTarget } from "@/ui/centerTodoScroll";
import {
  PANEL_STATE_LOADING_MESSAGE,
  renderPanelStateListRow,
} from "@/engine/panelStateChrome";
import {
  handleListRovingKeyDown,
  syncListRovingTabindex,
} from "@/ui/listRovingTabindex";
import {
  formatNextQueueFinishPreviewLine,
  QUEUE_NEXT_FINISH_PREVIEW_ACTION,
  QUEUE_NEXT_FINISH_PREVIEW_CLASS,
} from "@/net/nextQueueFinishPreview";
export const QUEUE_DAILY_NEXT_BUTTON_LABEL = "日常：下一步";

export { DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS } from "@/net/dailyQueueAnchor";

/** 建造队列行选中高亮（与日常/邮件列表 `selected` 口径一致）。 */
export const QUEUE_BUILD_ROW_SELECTED_CLASS = "selected";

export type QueuePanelReskin = (root: HTMLElement) => void;

/** 建造队列加速符（与 DATA-001 / content catalog item_cfg_id 2003 一致，勿新增 cfg）。 */
export const BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID = 2003;

const SPEEDUP_BUTTON_LABEL = "使用短促工符";

export class QueuePanels {
  private panel!: HTMLElement;
  private militarySection!: HTMLElement;
  private recruits: RecruitQueueEntry[] = [];
  private tickAccum = 0;
  private buildRowsSnapshot: {
    keys: string[]; rows: HTMLLIElement[]; current: () => boolean; session: MainCitySession;
  } | null = null;
  private speedupBusy = false;
  private speedupReloadOwner: (() => boolean) | null = null;
  private speedupOwner: (() => boolean) | null = null;
  private lifecycleVersion = 0;
  private cityReadVersion = 0;
  private cityReadOwner: (() => boolean) | null = null;
  private readonly completedRecruitIds = new Set<number>();
  private highlightedBuildSlotKey: string | null = null;
  private highlightedRecruitQueueId: number | null = null;
  private buildCompleteTodoSlots: string[] = [];
  private readonly completePulseSlots = new Set<string>();
  private readonly completePulseRecruitIds = new Set<number>();
  private readonly completeFocusPulseSlots = new Set<string>();
  private readonly completeFocusPulseRecruitIds = new Set<number>();
  private recruitDetectSnapshot: RecruitQueueEntry[] = [];
  private dailyAnchorHighlightBuildSlot: string | null = null;
  private dailyAnchorHighlightRecruitId: number | null = null;
  private dailyAnchorHighlightTimer: ReturnType<typeof setTimeout> | null = null;
  private buildListLoading = false;
  private buildListError: string | null = null;
  private focusTrap: CenterPanelFocusTrap | null = null;
  private readonly onListKeyDown = (ev: KeyboardEvent) => this.onQueueListKeyDown(ev);

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private readonly getSession: () => MainCitySession | null,
    private readonly slotLabels: Record<string, string>,
    private readonly onStatus: (msg: string) => void,
    private readonly onAfterCityRefresh: () => void,
    private readonly onMilitarySync: () => void,
    private readonly getDailyChainRows?: () => DailyQuestRow[],
    private readonly onOpenDailyBuildQuest?: (questCfgId: number) => void,
    private readonly reskinPrimary?: QueuePanelReskin,
    private readonly onBuildSlotHighlightChange?: (slotKey: string | null) => void,
    private readonly dismissToolbarTrigger?: () => HTMLElement | null,
    private readonly onRecruitQueueJumpToMilitary?: (entry: RecruitQueueEntry) => void,
    private readonly onLocateCitySlotFromQueue?: (slotKey: string) => void,
    private readonly onRecruitQueueJustCompleted?: (queueIds: number[]) => void,
    private readonly onQueueVisibilityChange?: (open: boolean) => void,
  ) {}

  attach(): void {
    ++this.lifecycleVersion;
    ++this.cityReadVersion;
    this.cityReadOwner = null;
    this.speedupOwner = null;
    this.speedupBusy = false;
    this.buildListLoading = false;
    this.buildListError = null;
    this.panel = this.buildPanel();
    this.mount.appendChild(this.panel);
    this.panel.addEventListener("click", (ev) => this.onClick(ev));
    this.panel.addEventListener("keydown", this.onListKeyDown);
    this.focusTrap = createCenterPanelFocusTrap(this.panel, () => this.closeFromKeyboard());
  }

  detach(): void {
    this.buildRowsSnapshot = null;
    ++this.lifecycleVersion;
    ++this.cityReadVersion;
    this.cityReadOwner = null;
    this.speedupOwner = null;
    this.speedupBusy = false;
    this.panel?.removeEventListener("keydown", this.onListKeyDown);
    this.focusTrap?.dispose();
    this.focusTrap = null;
    this.panel?.remove();
  }

  isOpen(): boolean {
    return !!this.panel && !this.panel.classList.contains("hidden");
  }

  getRoot(): HTMLElement {
    return this.panel;
  }

  getMilitarySectionRoot(): HTMLElement {
    return this.militarySection;
  }

  toggle(): void {
    const wasOpen = this.isOpen();
    toggleCenterPanel(this.panel);
    if (this.isOpen()) {
      resetQueuePanelViewportScroll(this.panel);
      this.tickAccum = 0;
      this.render();
      resetQueuePanelViewportScroll(this.panel);
      this.focusTrap?.setOpen(true, this.dismissToolbarTrigger?.() ?? null);
    } else if (wasOpen) {
      this.focusTrap?.setOpen(false, null, true);
    }
    this.onQueueVisibilityChange?.(this.isOpen());
  }

  /** 打开队列面板（日常练兵/建造引导）。 */
  open(): void {
    openCenterPanel(this.panel);
    resetQueuePanelViewportScroll(this.panel);
    this.tickAccum = 0;
    this.render();
    resetQueuePanelViewportScroll(this.panel);
    this.focusTrap?.setOpen(true, this.dismissToolbarTrigger?.() ?? null);
    this.onQueueVisibilityChange?.(true);
  }

  private closeFromKeyboard(): void {
    this.panel.classList.add("hidden");
    this.onQueueVisibilityChange?.(false);
  }

  private onQueueListKeyDown(ev: KeyboardEvent): void {
    if (!this.isOpen()) return;
    const buildUl = this.panel.querySelector<HTMLElement>('[data-role="queue-build-list"]');
    if (!buildUl) return;
    handleListRovingKeyDown(ev, buildUl, {
      itemSelector: "li.queue-list-row[data-slot-key]",
      onActivate: (row) => {
        const slotKey = row.dataset.slotKey?.trim();
        if (slotKey) this.openAndHighlightBuildSlot(slotKey);
      },
    });
  }

  /** CLIENT-134：底栏队列角标深链 — 打开并高亮首条建造进行中槽位。 */
  openFromTodoBadge(slotKey: string): void {
    const key = slotKey.trim();
    if (key) this.openAndHighlightBuildSlot(key);
    else this.open();
  }

  /** 打开队列并高亮指定槽位的建造行（主城画布深链）。 */
  openAndHighlightBuildSlot(slotKey: string): void {
    this.highlightedRecruitQueueId = null;
    this.highlightedBuildSlotKey = slotKey.trim() || null;
    this.onBuildSlotHighlightChange?.(this.highlightedBuildSlotKey);
    openCenterPanel(this.panel);
    this.tickAccum = 0;
    this.render();
    resetQueuePanelViewportScroll(this.panel);
    const rowId = queueBuildRowDomId(slotKey);
    const row = this.panel.querySelector(`#${CSS.escape(rowId)}`);
    if (row && typeof row.scrollIntoView === "function") {
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    this.pulseQueueRowForOverlaySlot(this.highlightedBuildSlotKey ?? "");
  }

  /** 七槽 overlay 选中 → 队列行 2s 高亮（CLIENT-180，只读快照）。 */
  pulseQueueRowForOverlaySlot(slotKey: string): void {
    const key = slotKey.trim();
    if (!key || !this.panel) return;
    const snapshot = {
      buildings: this.buildings(),
      recruits: this.recruits,
      nowMs: Date.now(),
    };
    highlightQueueRowForSlot(this.panel, key, snapshot);
    highlightDomesticQueueRowFocusRing(
      this.panel,
      key,
      snapshot,
      buildingBySlot(this.buildings(), key),
    );
  }

  clearBuildSlotHighlight(): void {
    if (!this.highlightedBuildSlotKey && this.highlightedRecruitQueueId === null) return;
    this.highlightedBuildSlotKey = null;
    this.highlightedRecruitQueueId = null;
    this.onBuildSlotHighlightChange?.(null);
    if (this.isOpen()) this.render();
  }

  /** 募兵互跳高亮（可不打开面板，仅更新高亮态）。 */
  highlightRecruitQueue(queueId: number, opts?: { open?: boolean }): void {
    const id = queueId > 0 ? queueId : null;
    this.highlightedRecruitQueueId = id;
    this.highlightedBuildSlotKey = id ? RECRUIT_QUEUE_MATRIX_SLOT_KEY : null;
    this.onBuildSlotHighlightChange?.(this.highlightedBuildSlotKey);
    if (opts?.open) {
      openCenterPanel(this.panel);
      this.tickAccum = 0;
    }
    if (this.isOpen() || opts?.open) {
      this.render();
      resetQueuePanelViewportScroll(this.panel);
      if (id) {
        const row = this.panel.querySelector(`#${CSS.escape(queueRecruitRowDomId(id))}`);
        if (row && typeof row.scrollIntoView === "function") {
          row.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
        this.pulseQueueRowForOverlaySlot(RECRUIT_QUEUE_MATRIX_SLOT_KEY);
      }
    }
  }

  /** 打开队列并高亮募兵行，与兵营矩阵格互高亮（CLIENT-149）。 */
  openAndHighlightRecruitQueue(queueId: number): void {
    this.highlightRecruitQueue(queueId, { open: true });
  }

  /** 日常「前往下一步」：匹配队列行 `daily-queue-anchor-highlight` 2s（可与槽位/进度 class 叠加）。 */
  flashDailyQueueAnchorHighlight(target: DailyQueueAnchorTarget | null): void {
    if (!target) return;
    if (this.dailyAnchorHighlightTimer != null) {
      clearTimeout(this.dailyAnchorHighlightTimer);
      this.dailyAnchorHighlightTimer = null;
    }
    if (target.kind === "build") {
      this.dailyAnchorHighlightRecruitId = null;
      this.dailyAnchorHighlightBuildSlot = target.slotKey;
      this.openAndHighlightBuildSlot(target.slotKey);
    } else {
      this.dailyAnchorHighlightBuildSlot = null;
      this.dailyAnchorHighlightRecruitId = target.queueId;
      this.openAndHighlightRecruitQueue(target.queueId);
    }
    this.dailyAnchorHighlightTimer = window.setTimeout(() => {
      this.dailyAnchorHighlightBuildSlot = null;
      this.dailyAnchorHighlightRecruitId = null;
      this.dailyAnchorHighlightTimer = null;
      if (this.isOpen()) this.render();
    }, DAILY_QUEUE_ANCHOR_HIGHLIGHT_MS);
  }

  getHighlightedBuildSlotKey(): string | null {
    return this.highlightedBuildSlotKey;
  }

  getHighlightedRecruitQueueId(): number | null {
    return this.highlightedRecruitQueueId;
  }

  /** GetCityState 检测到建造刚完成时触发队列行完成脉冲。 */
  notifyBuildJustCompleted(slotKeys: readonly string[]): void {
    if (!slotKeys.length) return;
    for (const key of slotKeys) {
      if (!key) continue;
      this.completePulseSlots.add(key);
      this.completeFocusPulseSlots.add(key);
      window.setTimeout(() => {
        this.completePulseSlots.delete(key);
        if (this.isOpen()) this.render();
      }, QUEUE_BUILD_COMPLETE_PULSE_MS);
      window.setTimeout(() => {
        this.completeFocusPulseSlots.delete(key);
        if (this.isOpen()) this.render();
      }, QUEUE_ROW_COMPLETE_PULSE_MS);
    }
    if (this.isOpen()) {
      this.render();
      this.applyCompletePulses(slotKeys);
      this.applyCompleteFocusPulses(slotKeys);
    }
  }

  private applyCompletePulses(slotKeys: readonly string[]): void {
    for (const key of slotKeys) {
      scheduleQueueBuildCompletePulse(this.findQueueRowForSlot(key));
    }
  }

  private applyCompleteFocusPulses(slotKeys: readonly string[]): void {
    for (const key of slotKeys) {
      scheduleQueueRowCompletePulse(this.findQueueRowForSlot(key));
    }
  }

  /** 募兵批次刚完成时触发队列行完成脉冲（与提交成功 `recruit-row-pulse` 区分）。 */
  notifyRecruitJustCompleted(queueIds: readonly number[]): void {
    if (!queueIds.length) return;
    for (const id of queueIds) {
      if (id <= 0) continue;
      this.completePulseRecruitIds.add(id);
      this.completeFocusPulseRecruitIds.add(id);
      window.setTimeout(() => {
        this.completePulseRecruitIds.delete(id);
        if (this.isOpen()) this.render();
      }, QUEUE_RECRUIT_COMPLETE_PULSE_MS);
      window.setTimeout(() => {
        this.completeFocusPulseRecruitIds.delete(id);
        if (this.isOpen()) this.render();
      }, QUEUE_ROW_COMPLETE_PULSE_MS);
    }
    if (this.isOpen()) {
      this.render();
      this.applyRecruitCompletePulses(queueIds);
      this.applyRecruitCompleteFocusPulses(queueIds);
    }
  }

  private applyRecruitCompletePulses(queueIds: readonly number[]): void {
    for (const id of queueIds) {
      scheduleQueueRecruitCompletePulse(this.findRecruitRow(id));
    }
  }

  private applyRecruitCompleteFocusPulses(queueIds: readonly number[]): void {
    for (const id of queueIds) {
      scheduleQueueRowCompletePulse(this.findRecruitRow(id));
    }
  }

  private findRecruitRow(queueId: number): HTMLElement | null {
    const row = this.panel.querySelector(`#${CSS.escape(queueRecruitRowDomId(queueId))}`);
    return row instanceof HTMLElement ? row : null;
  }

  private findQueueRowForSlot(slotKey: string): HTMLElement | null {
    const rowId = queueBuildRowDomId(slotKey);
    const byId = this.panel.querySelector(`#${CSS.escape(rowId)}`);
    if (byId instanceof HTMLElement) return byId;
    const byData = this.panel.querySelector(
      `li.queue-list-row[data-slot-key="${CSS.escape(slotKey)}"]`,
    );
    return byData instanceof HTMLElement ? byData : null;
  }

  setBuildCompleteTodoSlots(slotKeys: string[]): void {
    this.buildCompleteTodoSlots = slotKeys.slice();
    if (this.isOpen()) this.render();
  }

  /** CLIENT-077：顶栏待办深链到建造完成行。 */
  openFromCenterTodoBuildComplete(
    slotKey: string,
    opts?: { skipScroll?: boolean; onAcknowledge?: () => void },
  ): boolean {
    const wasOpen = this.isOpen();
    this.open();
    this.render();
    if (!opts?.skipScroll && slotKey) {
      scrollCenterTodoTarget(this.panel, centerTodoScrollTargetId("queue", slotKey));
    }
    opts?.onAcknowledge?.();
    return wasOpen;
  }

  addRecruitEntry(entry: RecruitQueueEntry | null): void {
    if (!entry) return;
    this.recruits = mergeRecruitQueue(this.recruits, entry);
    this.recruitDetectSnapshot = this.recruits.map((e) => ({ ...e }));
    if (this.isOpen()) this.render();
  }

  /** CLIENT-117：募兵提交成功后队列募兵行 3s 脉冲。 */
  pulseRecruitRow(queueId: number): void {
    const id = queueRecruitRowDomId(queueId);
    scheduleRecruitRowPulse(this.panel.querySelector<HTMLElement>(`#${CSS.escape(id)}`));
  }

  /** 日常面板只读募兵队列快照（与 render 同源，不新 RPC）。 */
  getRecruitQueueSnapshot(): RecruitQueueEntry[] {
    const now = Date.now();
    return pruneFinishedRecruits(this.recruits, now).filter((e) => isRecruitQueueActive(e, now));
  }

  tick(dt: number): void {
    if (!this.isOpen()) {
      this.tickAccum = 0;
      return;
    }
    this.tickAccum += dt;
    if (this.tickAccum < 1) return;
    this.tickAccum = 0;
    this.render();
    if (this.gateway.preparedRecruit !== true) void this.checkRecruitCompletions();
  }

  private buildPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel product-chrome-panel hidden";
    el.dataset.centerPanel = "queue";
    el.innerHTML = `
      <h3>队列</h3>
      <p class="queue-panel-overview" data-role="queue-overview"></p>
      <p class="${QUEUE_NEXT_FINISH_PREVIEW_CLASS} hidden" data-role="queue-next-finish-preview" data-action="${QUEUE_NEXT_FINISH_PREVIEW_ACTION}" role="button" tabindex="0" hidden></p>
      <div class="queue-build-matrix" data-role="queue-build-matrix" aria-label="七槽建造状态"></div>
      <p class="queue-panel-hint">内政升级与募兵排队（打开时每秒刷新）。进行中建造可使用短促工符加速。</p>
      <div class="content-panel-actions">
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="refresh-queue">刷新内政</button>
      </div>
      <div class="panel-scroll-body" data-role="queue-scroll">
        <ul class="queue-list" data-role="queue-build-list"></ul>
        <div class="queue-military-section hidden" data-role="queue-military-section">
          <p class="queue-military-heading">募兵队列</p>
          <ul class="queue-list" data-role="queue-recruit-list"></ul>
        </div>
      </div>
      <p class="queue-panel-status" data-role="queue-status"></p>
    `;
    this.militarySection = el.querySelector('[data-role="queue-military-section"]') as HTMLElement;
    return el;
  }

  private serverId(): number {
    const s = this.getSession();
    return s?.serverId ?? this.gateway.getBoundServerId() ?? s?.player?.server_id ?? 0;
  }

  private buildings(): CityBuilding[] {
    return this.getSession()?.buildings ?? [];
  }

  private canUseBuildSpeedup(now: number): boolean {
    if (activeBuildingUpgrades(this.buildings(), now).length === 0) return false;
    const bag = this.getSession()?.bag ?? [];
    return bagStackQuantity(bag, BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID) >= 1;
  }

  private renderBuildSlotMatrix(now: number): void {
    const matrixEl = this.panel.querySelector('[data-role="queue-build-matrix"]');
    if (!matrixEl) return;
    const session = this.getSession();
    if (!session) {
      matrixEl.replaceChildren();
      matrixEl.classList.add("hidden");
      return;
    }
    matrixEl.classList.remove("hidden");
    const cells = buildBuildQueueSlotMatrix(
      session.buildings,
      session.wallet,
      this.slotLabels,
      now,
    );
    matrixEl.replaceChildren();
    for (const cell of cells) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "queue-build-matrix-cell";
      btn.dataset.action = "queue-matrix-slot";
      btn.dataset.slotKey = cell.slotKey;
      btn.dataset.matrixIndex = String(cell.matrixIndex);
      btn.dataset.status = cell.status;
      btn.title = cell.title;
      btn.setAttribute("aria-label", cell.title);
      btn.textContent = cell.abbrev;
      if (this.highlightedBuildSlotKey === cell.slotKey) {
        btn.classList.add("queue-build-matrix-cell-selected");
        btn.classList.add(QUEUE_BUILD_SLOT_MUTUAL_HIGHLIGHT_CLASS);
      }
      if (
        this.highlightedRecruitQueueId !== null &&
        cell.slotKey === RECRUIT_QUEUE_MATRIX_SLOT_KEY
      ) {
        btn.classList.add("queue-build-matrix-cell-selected");
        btn.classList.add(QUEUE_RECRUIT_SLOT_MUTUAL_HIGHLIGHT_CLASS);
      }
      matrixEl.appendChild(btn);
    }
  }

  private renderNextQueueFinishPreview(previewEl: Element | null, nowMs: number): void {
    if (!(previewEl instanceof HTMLElement)) return;
    const dailyRows = this.getDailyChainRows?.() ?? [];
    const preview = formatNextQueueFinishPreviewLine(
      this.buildings(),
      this.recruits,
      this.slotLabels,
      dailyRows,
      nowMs,
    );
    if (!preview) {
      previewEl.hidden = true;
      previewEl.classList.add("hidden");
      previewEl.textContent = "";
      previewEl.removeAttribute("data-quest-cfg-id");
      previewEl.removeAttribute("title");
      return;
    }
    previewEl.hidden = false;
    previewEl.classList.remove("hidden");
    previewEl.textContent = preview.line;
    if (preview.questCfgId > 0 && this.onOpenDailyBuildQuest) {
      previewEl.dataset.questCfgId = String(preview.questCfgId);
      previewEl.title = `打开日常 #${preview.questCfgId}`;
    } else {
      previewEl.removeAttribute("data-quest-cfg-id");
      previewEl.title = "下一队列完成预览（只读）";
    }
  }

  private render(): void {
    const previousBuildRows = this.buildRowsSnapshot;
    this.buildRowsSnapshot = null;
    this.speedupBusy = this.speedupOwner?.() ?? false;
    if (this.speedupReloadOwner && !this.speedupReloadOwner()) this.speedupReloadOwner = null;
    if (this.cityReadOwner && !this.cityReadOwner()) {
      this.cityReadOwner = null;
      this.buildListLoading = false;
      this.buildListError = null;
    }
    const buildUl = this.panel.querySelector<HTMLElement>('[data-role="queue-build-list"]');
    const recruitUl = this.panel.querySelector('[data-role="queue-recruit-list"]');
    const overviewEl = this.panel.querySelector('[data-role="queue-overview"]');
    const previewEl = this.panel.querySelector('[data-role="queue-next-finish-preview"]');
    if (!buildUl || !recruitUl) return;
    const session = this.getSession();
    const prepared = this.gateway.preparedRecruit === true;
    const currentRecruitQueue = session?.currentRecruitQueue ?? null;
    const now = Date.now();
    if (!prepared) {
      const prevRecruitSnapshot = this.recruitDetectSnapshot;
      this.recruits = pruneFinishedRecruits(this.recruits, now);
      const recruitJustCompleted = detectRecruitQueueJustCompleted(prevRecruitSnapshot, this.recruits, now);
      // Pulse rendering is re-entrant: advance detection before notifying completion.
      this.recruitDetectSnapshot = this.recruits.map((e) => ({ ...e }));
      if (recruitJustCompleted.length) {
        this.notifyRecruitJustCompleted(recruitJustCompleted);
        this.onRecruitQueueJustCompleted?.(recruitJustCompleted);
      }
    }
    if (overviewEl) {
      const recruitCount = currentRecruitQueue
        ? `${currentRecruitQueue.jobs.length}${currentRecruitQueue.hasMore ? "+" : ""}` : "待同步";
      overviewEl.textContent = prepared
        ? `建造 ${activeBuildingUpgrades(this.buildings(), now).length} · 募兵 ${recruitCount}`
        : formatQueuePanelOverviewBar(this.buildings(), this.recruits, now);
    }
    this.renderNextQueueFinishPreview(previewEl, now);
    this.renderBuildSlotMatrix(now);
    if (!session) {
      buildUl.replaceChildren();
      renderPanelStateListRow(buildUl, "loading", PANEL_STATE_LOADING_MESSAGE, {
        legacyClass: "queue-list-empty",
      });
      recruitUl.replaceChildren();
      this.militarySection.classList.add("hidden");
      return;
    }
    const speedupEnabled = this.canUseBuildSpeedup(now) && !this.speedupBusy && !this.speedupReloadOwner;
    const buildRows = sortBuildQueueRows(this.buildings(), now);
    const recruitLines = this.recruits.map((r) => formatRecruitQueueLine(r, now));
    const completeSlots = this.buildCompleteTodoSlots.filter(
      (key) => !buildRows.some((b) => b.slot_key === key),
    );

    const keys = buildRows.map((b) => {
      const slot = b.slot_key, cfg = b.building_cfg_id ?? buildingCfgIdForSlot(slot ?? "");
      const level = b.level ?? 0, finish = b.upgrade_finish_at_ms;
      const start = inferBuildUpgradeStartedAtMs(b);
      if (!slot || slot.trim() !== slot || !Number.isSafeInteger(cfg) || cfg <= 0 ||
          !Number.isSafeInteger(level) || level < 0 || !Number.isSafeInteger(finish) ||
          start == null || !Number.isFinite(start)) return null;
      return JSON.stringify([slot, cfg, level, finish, start]);
    });
    const eligible = !this.buildListLoading && !this.buildListError && !completeSlots.length &&
      keys.length > 0 && keys.every((key) => key !== null) &&
      new Set(buildRows.map((b) => b.slot_key)).size === buildRows.length;
    const stableRows = eligible && previousBuildRows?.session === session &&
      previousBuildRows.current() && keys.length === previousBuildRows.keys.length &&
      keys.every((key, i) => key === previousBuildRows.keys[i] &&
        buildUl.children[i] === previousBuildRows.rows[i] &&
        previousBuildRows.rows[i].querySelector(':scope > button[data-action="speedup-build"]')) &&
      buildUl.children.length === keys.length ? previousBuildRows.rows : null;
    if (!stableRows) buildUl.innerHTML = "";
    recruitUl.innerHTML = "";
    this.militarySection.classList.toggle("hidden", !prepared && recruitLines.length === 0);
    if (prepared) renderCurrentRecruitQueue(recruitUl, currentRecruitQueue);

    if (this.buildListLoading) {
      renderPanelStateListRow(buildUl, "loading", PANEL_STATE_LOADING_MESSAGE);
      return;
    }

    if (this.buildListError) {
      renderPanelGatewayErrorListRow(buildUl, this.buildListError, {
        legacyClass: "queue-list-empty",
        retryAction: "retry-refresh-queue-build",
      });
      return;
    }

    if (!prepared && !buildRows.length && !recruitLines.length && !completeSlots.length) {
      renderPanelStateListRow(buildUl, "empty", "（当前无排队中的升级或募兵）", {
        legacyClass: "queue-list-empty",
      });
      return;
    }

    if (!buildRows.length && !completeSlots.length) {
      renderPanelStateListRow(buildUl, "empty", "（当前无排队中的内政升级）", {
        legacyClass: "queue-list-empty",
      });
    }

    const dailyRows = this.getDailyChainRows?.() ?? [];

    for (const slotKey of completeSlots) {
      const name = this.slotLabels[slotKey] ?? slotKey;
      const building = buildingBySlot(this.buildings(), slotKey);
      const lv = building?.level ?? 0;
      const li = document.createElement("li");
      li.className = "queue-list-row queue-build-complete-todo";
      li.classList.add(QUEUE_ROW_COMPLETE_READONLY_CLASS);
      li.dataset.slotKey = slotKey;
      li.setAttribute(TODO_SCROLL_TARGET_ATTR, centerTodoScrollTargetId("queue", slotKey));
      if (this.highlightedBuildSlotKey === slotKey) {
        li.classList.add(QUEUE_BUILD_ROW_SELECTED_CLASS);
        li.classList.add(QUEUE_BUILD_SLOT_MUTUAL_HIGHLIGHT_CLASS);
      }
      if (this.completePulseSlots.has(slotKey)) {
        li.classList.add("queue-build-complete-pulse");
      }
      if (this.completeFocusPulseSlots.has(slotKey)) {
        li.classList.add(QUEUE_ROW_COMPLETE_PULSE_CLASS);
      }
      const span = document.createElement("span");
      span.textContent = `[内政] ${name} · 建造已完成 Lv${lv} · 点「刷新内政」确认等级`;
      li.appendChild(span);
      buildUl.appendChild(li);
    }

    const renderedRows: HTMLLIElement[] = [];
    for (const [index, b] of buildRows.entries()) {
      const text = formatBuildingUpgradeQueueLine(b, this.slotLabels, now);
      const li = document.createElement("li");
      const slotKey = b.slot_key ?? "?";
      li.className = "queue-list-row";
      li.id = queueBuildRowDomId(slotKey);
      li.dataset.slotKey = slotKey;
      applyQueueRowBuildingCfgIdDataset(li, b);
      if (slotKey && slotKey !== "?") {
        li.setAttribute(TODO_SCROLL_TARGET_ATTR, centerTodoScrollTargetId("queue", slotKey));
      }
      if (this.highlightedBuildSlotKey && slotKey === this.highlightedBuildSlotKey) {
        li.classList.add(QUEUE_BUILD_ROW_SELECTED_CLASS);
        li.classList.add(QUEUE_BUILD_SLOT_MUTUAL_HIGHLIGHT_CLASS);
      }
      if (this.completePulseSlots.has(slotKey)) {
        li.classList.add("queue-build-complete-pulse");
      }
      if (this.dailyAnchorHighlightBuildSlot && slotKey === this.dailyAnchorHighlightBuildSlot) {
        li.classList.add(DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS);
      }
      const span = document.createElement("span");
      span.textContent = text;
      li.appendChild(span);
      appendQueueRemainingProgressRow(
        li,
        b.upgrade_finish_at_ms ?? 0,
        now,
        inferBuildUpgradeStartedAtMs(b),
      );
      const linkedQuest = findBuildDailyQuestForBuilding(b, dailyRows, now);
      if (linkedQuest) {
        const progressSummary = formatLinkedDailyQuestProgressSummary(linkedQuest);
        if (progressSummary) {
          const prog = document.createElement("span");
          prog.className = "queue-daily-progress";
          prog.textContent = progressSummary;
          li.appendChild(prog);
        }
      }
      if (linkedQuest && this.onOpenDailyBuildQuest) {
        const cfgId = linkedQuest.quest_cfg_id ?? 0;
        const dailyBtn = document.createElement("button");
        dailyBtn.type = "button";
        dailyBtn.setAttribute("data-action", "daily-build-next");
        if (cfgId > 0) dailyBtn.setAttribute("data-quest-cfg-id", String(cfgId));
        dailyBtn.textContent = QUEUE_DAILY_NEXT_BUTTON_LABEL;
        li.appendChild(dailyBtn);
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "art-btn-primary";
      btn.setAttribute("data-action", "speedup-build");
      btn.dataset.queueSpeedupItem = String(BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID);
      btn.textContent = SPEEDUP_BUTTON_LABEL;
      if (!speedupEnabled) {
        btn.disabled = true;
        if (bagStackQuantity(this.getSession()?.bag ?? [], BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID) < 1) {
          btn.title = "背包中无短促工符（道具 2003）";
        }
      }
      li.appendChild(btn);
      const retained = stableRows?.[index];
      if (retained) {
        const button = retained.querySelector<HTMLButtonElement>(
          ':scope > button[data-action="speedup-build"]',
        )!;
        // Keep skin-owned attributes, handlers and icon; never detach the focus target.
        button.dataset.queueSpeedupItem = btn.dataset.queueSpeedupItem;
        button.disabled = btn.disabled;
        button.title = btn.title;
        for (const attr of Array.from(retained.attributes)) {
          if (attr.name !== "tabindex" && !li.hasAttribute(attr.name)) retained.removeAttribute(attr.name);
        }
        for (const attr of Array.from(li.attributes)) retained.setAttribute(attr.name, attr.value);
        for (const child of Array.from(retained.childNodes)) if (child !== button) child.remove();
        for (const child of Array.from(li.childNodes)) {
          if (child !== btn) retained.insertBefore(child, button);
        }
        renderedRows.push(retained);
      } else {
        buildUl.appendChild(li);
        renderedRows.push(li);
      }
    }
    if (eligible) this.buildRowsSnapshot = {
      keys: keys as string[], rows: renderedRows, current: this.captureQueueContext(), session,
    };

    syncListRovingTabindex(buildUl, "li.queue-list-row[data-slot-key]");

    for (const entry of prepared ? [] : this.recruits) {
      const text = formatRecruitQueueLine(entry, now);
      const li = document.createElement("li");
      li.className = "queue-list-row";
      li.id = queueRecruitRowDomId(entry.queue_id);
      li.dataset.queueId = String(entry.queue_id);
      if (this.highlightedRecruitQueueId === entry.queue_id) {
        li.classList.add(QUEUE_BUILD_ROW_SELECTED_CLASS);
        li.classList.add(QUEUE_RECRUIT_SLOT_MUTUAL_HIGHLIGHT_CLASS);
      }
      if (this.completePulseRecruitIds.has(entry.queue_id)) {
        li.classList.add("queue-recruit-complete-pulse");
      }
      if (this.completeFocusPulseRecruitIds.has(entry.queue_id)) {
        li.classList.add(QUEUE_ROW_COMPLETE_PULSE_CLASS);
      }
      if (
        this.dailyAnchorHighlightRecruitId != null &&
        entry.queue_id === this.dailyAnchorHighlightRecruitId
      ) {
        li.classList.add(DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS);
      }
      const span = document.createElement("span");
      span.textContent = text;
      li.appendChild(span);
      if (!isRecruitQueueActive(entry, now)) {
        li.classList.add(QUEUE_ROW_COMPLETE_READONLY_CLASS);
      }
      if (isRecruitQueueActive(entry, now)) {
        appendQueueRemainingProgressRow(
          li,
          entry.finish_at_ms,
          now,
          inferRecruitQueueStartedAtMs(entry),
        );
      }
      const linkedTrainQuest = findTrainDailyQuestForRecruit(entry, dailyRows, now);
      if (linkedTrainQuest && this.onOpenDailyBuildQuest) {
        const cfgId = linkedTrainQuest.quest_cfg_id ?? 0;
        const dailyBtn = document.createElement("button");
        dailyBtn.type = "button";
        dailyBtn.setAttribute("data-action", "daily-build-next");
        if (cfgId > 0) dailyBtn.setAttribute("data-quest-cfg-id", String(cfgId));
        dailyBtn.textContent = QUEUE_DAILY_NEXT_BUTTON_LABEL;
        li.appendChild(dailyBtn);
      }
      recruitUl.appendChild(li);
    }
    this.reskinPrimary?.(this.panel);
  }

  private setPanelStatus(msg: string): void {
    const el = this.panel.querySelector('[data-role="queue-status"]');
    if (el) el.textContent = msg;
  }

  private async checkRecruitCompletions(): Promise<void> {
    const current = this.captureQueueContext();
    const now = Date.now();
    for (const entry of this.recruits) {
      if (!current()) return;
      if (isRecruitQueueActive(entry, now)) continue;
      if (this.completedRecruitIds.has(entry.queue_id)) continue;
      this.completedRecruitIds.add(entry.queue_id);
      this.notifyRecruitJustCompleted([entry.queue_id]);
      this.onRecruitQueueJustCompleted?.([entry.queue_id]);
      this.onStatus(`募兵 #${entry.queue_id} 已完成，请刷新军事兵力`);
      this.setPanelStatus("募兵已完成：可刷新内政并打开军事查看兵力。");
      this.onMilitarySync();
      await this.refreshCityState();
    }
  }

  private captureQueueContext(): () => boolean {
    const actor = captureActor(this.gateway, this.getSession);
    const version = this.lifecycleVersion;
    const panel = this.panel;
    return () => actor() && version === this.lifecycleVersion && this.panel === panel && panel?.parentElement === this.mount;
  }

  private async refreshCityState(reportSuccess = false): Promise<void> {
    const session = this.getSession();
    const context = this.captureQueueContext();
    if (!session || !context()) return;
    const version = ++this.cityReadVersion;
    const current = () => context() && version === this.cityReadVersion;
    this.cityReadOwner = current;
    this.buildListLoading = true;
    this.buildListError = null;
    this.render();
    const recovering = reportSuccess && !!this.speedupReloadOwner?.();
    try {
      if (recovering) {
        if (this.speedupOwner?.()) return;
        if (!await refreshQuestAssets(this.gateway, this.getSession,
          (patch) => Object.assign(this.getSession()!, patch), current)) return;
        if (!current()) return;
      }
      const { bag, wallet } = this.getSession()!;
      const freshAssets = beginAssetRead(this.gateway);
      const state = (await this.gateway.getCityState(session.cityId)) as {
        buildings?: CityBuilding[];
        wallet?: MainCitySession["wallet"];
        production_rates?: MainCitySession["productionRates"];
      };
      if (!current()) return;
      if (recovering && (!freshAssets() || this.getSession()?.bag !== bag || this.getSession()?.wallet !== wallet)) {
        throw new Error(QUEST_ASSETS_PENDING);
      }
      if (recovering) this.speedupReloadOwner = null;
      if (state.buildings) session.buildings = state.buildings;
      if (state.wallet && freshAssets() && this.getSession()?.bag === bag && this.getSession()?.wallet === wallet) {
        this.getSession()!.wallet = mergeCityResourceWallet(wallet, state.wallet);
      }
      if (state.production_rates) session.productionRates = state.production_rates;
      this.onAfterCityRefresh();
      if (reportSuccess && current()) this.setPanelStatus("已刷新内政状态");
    } catch (e) {
      if (!current()) return;
      this.buildListError = formatPanelGatewayErrorFromUnknownForList("buildQueue", e);
      this.setPanelStatus(this.buildListError);
    } finally {
      if (current()) {
        this.buildListLoading = false;
        this.render();
      }
    }
  }

  private async useBuildSpeedup(): Promise<void> {
    if (this.speedupOwner?.() || this.speedupReloadOwner?.()) return;
    const context = this.captureQueueContext();
    const current = () => context() && this.speedupOwner === current;
    if (!this.getSession() || !context()) return;
    const now = Date.now();
    if (!this.canUseBuildSpeedup(now)) {
      const msg =
        activeBuildingUpgrades(this.buildings(), now).length === 0
          ? "当前无进行中的建造，无法使用短促工符"
          : "背包中短促工符不足（需要道具 2003×1）";
      this.setPanelStatus(msg);
      this.onStatus(msg);
      return;
    }
    const itemId = BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID;
    this.speedupOwner = current;
    this.speedupBusy = true;
    this.render();
    this.onStatus(`队列：${SPEEDUP_BUTTON_LABEL}…`);
    try {
      const result = await useBagItemWithAssets(this.gateway, itemId, 1, this.getSession,
        (patch) => Object.assign(this.getSession()!, patch), current);
      if (!result || !current()) return;
      this.speedupReloadOwner = result.synced ? null : context;
      const res = result.response;
      const summary = formatUseConsumableEffectSummary(itemId, res);
      this.setPanelStatus(summary);
      this.onStatus(summary);
      if (result.synced) await this.refreshCityState();
      else this.setPanelStatus(`${summary}；${QUEST_ASSETS_PENDING}，请刷新队列核对`);
    } catch (e) {
      if (!current()) return;
      this.speedupReloadOwner = context;
      const msg = `${gatewayErrorMessage(e)}；${BAG_USE_UNKNOWN} 请刷新队列核对当前状态。`;
      this.setPanelStatus(msg);
      this.onStatus(msg);
    } finally {
      if (this.speedupOwner === current) {
        this.speedupOwner = null;
        this.speedupBusy = false;
        if (context()) this.render();
      }
    }
  }

  private onClick(ev: Event): void {
    const target = ev.target as HTMLElement;
    const matrixBtn = target.closest('[data-action="queue-matrix-slot"]');
    if (matrixBtn instanceof HTMLElement) {
      const slotKey = matrixBtn.dataset.slotKey?.trim();
      if (slotKey) {
        const now = Date.now();
        const barracksUpgrading = this.buildings().some(
          (b) =>
            b.slot_key === RECRUIT_QUEUE_MATRIX_SLOT_KEY &&
            (b.upgrade_finish_at_ms ?? 0) > now,
        );
        const activeRecruit = this.recruits.find((e) => isRecruitQueueActive(e, now));
        if (
          slotKey === RECRUIT_QUEUE_MATRIX_SLOT_KEY &&
          activeRecruit &&
          !barracksUpgrading
        ) {
          this.openAndHighlightRecruitQueue(activeRecruit.queue_id);
        } else {
          this.openAndHighlightBuildSlot(slotKey);
        }
      }
      return;
    }
    const previewAnchor = target.closest(`[data-action="${QUEUE_NEXT_FINISH_PREVIEW_ACTION}"]`);
    if (previewAnchor instanceof HTMLElement) {
      const cfgId = Number(previewAnchor.getAttribute("data-quest-cfg-id")) || 0;
      if (cfgId > 0 && this.onOpenDailyBuildQuest) {
        this.onOpenDailyBuildQuest(cfgId);
      }
      return;
    }
    const btn = target.closest("button");
    if (!btn) {
      const recruitRow = target.closest("li.queue-list-row[data-queue-id]");
      if (recruitRow instanceof HTMLElement) {
        const qid = Number(recruitRow.dataset.queueId) || 0;
        if (qid > 0) {
          const entry = this.recruits.find((e) => e.queue_id === qid);
          const now = Date.now();
          if (entry && !isRecruitQueueActive(entry, now)) {
            this.onLocateCitySlotFromQueue?.(RECRUIT_QUEUE_MATRIX_SLOT_KEY);
            this.openAndHighlightRecruitQueue(qid);
          } else if (entry && this.onRecruitQueueJumpToMilitary) {
            this.onRecruitQueueJumpToMilitary(entry);
          } else if (qid > 0) {
            this.openAndHighlightRecruitQueue(qid);
          }
        }
        return;
      }
      const row = target.closest("li.queue-list-row[data-slot-key]");
      if (row instanceof HTMLElement) {
        const slotKey = row.dataset.slotKey?.trim();
        if (slotKey) {
          this.onLocateCitySlotFromQueue?.(slotKey);
          this.openAndHighlightBuildSlot(slotKey);
        }
      }
      return;
    }
    const action = btn.getAttribute("data-action");
    if (action === "refresh-queue" || action === "retry-refresh-queue-build") {
      void this.refreshCityState(true);
    } else if (action === "speedup-build") {
      void this.useBuildSpeedup();
    } else if (action === "daily-build-next" || action === QUEUE_NEXT_FINISH_PREVIEW_ACTION) {
      const cfgId = Number(btn.getAttribute("data-quest-cfg-id")) || 0;
      if (cfgId > 0 && this.onOpenDailyBuildQuest) {
        this.onOpenDailyBuildQuest(cfgId);
      }
    }
  }
}
