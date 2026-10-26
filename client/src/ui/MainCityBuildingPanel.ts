import { openCenterPanel } from "@/ui/centerPanelForeground";
import type { CityBuilding, MainCitySession, ResourceWallet } from "@/net/bootstrapSession";
import {
  buildSubmitButtonDisabled,
  buildSubmitButtonLabel,
  type BuildSubmitState,
} from "@/net/buildSubmitFeedback";
import { buildingBySlot } from "@/net/hudFormat";
import { formatBuildUpgradeCostLine } from "@/net/buildUpgradeCostLine";
import { previewUpgradeCost } from "@/net/previewUpgradeCost";
import { buildUpgradePrerequisiteHint } from "@/net/buildUpgradePrerequisite";
import {
  applyPanelStateChrome,
  PANEL_STATE_CHROME_CLASS,
  PANEL_STATE_LOADING_MESSAGE,
} from "@/engine/panelStateChrome";
import { createCenterPanelFocusTrap, type CenterPanelFocusTrap } from "@/ui/centerPanelFocusTrap";
import { resetCenterPanelViewportScroll } from "@/ui/contentPanelScroll";

export type MainCityBuildingPanelReskin = (root: HTMLElement) => void;

export class MainCityBuildingPanel {
  private panel!: HTMLElement;
  private selectedSlotKey: string | null = null;
  private focusTrap: CenterPanelFocusTrap | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly slotLabels: Record<string, string>,
    private readonly getSession: () => MainCitySession | null,
    private readonly onUpgrade: (slotKey: string, buildingCfgId: number) => void,
    private readonly getSubmitState: () => BuildSubmitState,
    private readonly reskin?: MainCityBuildingPanelReskin,
    private readonly defaultDismissTrigger?: () => HTMLElement | null,
  ) {}

  attach(): void {
    this.panel = document.createElement("div");
    this.panel.className = "building-panel hidden";
    this.panel.dataset.centerPanel = "building";
    this.panel.innerHTML = `
      <h3 data-role="build-title">建造</h3>
      <div class="panel-scroll-body" data-role="building-scroll">
        <p class="building-level-line" data-role="build-level"></p>
        <p class="building-upgrade-preview" data-role="build-preview"></p>
        <p class="build-form-error hidden" data-role="build-prerequisite" id="build-prerequisite" role="status"></p>
        <p class="build-form-error hidden" data-role="build-form-error" role="alert"></p>
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="confirm-upgrade" aria-describedby="build-prerequisite" disabled>
          确认升级
        </button>
      </div>
    `;
    this.mount.appendChild(this.panel);
    this.panel.addEventListener("click", (ev) => this.onClick(ev));
    this.focusTrap = createCenterPanelFocusTrap(this.panel, () => this.close());
    this.reskin?.(this.panel);
  }

  detach(): void {
    this.focusTrap?.dispose();
    this.focusTrap = null;
    this.panel?.remove();
  }

  getRoot(): HTMLElement {
    return this.panel;
  }

  isOpen(): boolean {
    return !!this.panel && !this.panel.classList.contains("hidden");
  }

  close(): void {
    this.focusTrap?.setOpen(false);
    this.panel?.classList.add("hidden");
    this.selectedSlotKey = null;
  }

  selectSlot(slotKey: string, opts?: { dismissTrigger?: HTMLElement | null }): void {
    this.selectedSlotKey = slotKey.trim() || null;
    openCenterPanel(this.panel);
    resetCenterPanelViewportScroll(this.panel);
    this.render();
    resetCenterPanelViewportScroll(this.panel);
    const trigger =
      opts?.dismissTrigger ?? this.defaultDismissTrigger?.() ?? null;
    this.focusTrap?.setOpen(true, trigger);
  }

  sync(): void {
    if (!this.isOpen() || !this.selectedSlotKey) return;
    this.render();
  }

  setFormError(message: string | null): void {
    const el = this.panel?.querySelector('[data-role="build-form-error"]');
    if (!el) return;
    if (message?.trim()) {
      el.textContent = message;
      el.classList.remove("hidden");
    } else {
      el.textContent = "";
      el.classList.add("hidden");
    }
  }

  private buildingForSlot(slotKey: string): CityBuilding | undefined {
    return buildingBySlot(this.getSession()?.buildings, slotKey);
  }

  private wallet(): ResourceWallet | undefined {
    return this.getSession()?.wallet;
  }

  render(): void {
    if (!this.panel) return;
    const slotKey = this.selectedSlotKey;
    const titleEl = this.panel.querySelector('[data-role="build-title"]');
    const levelEl = this.panel.querySelector('[data-role="build-level"]');
    const previewEl = this.panel.querySelector('[data-role="build-preview"]');
    const prerequisiteEl = this.panel.querySelector('[data-role="build-prerequisite"]');
    const btn = this.panel.querySelector<HTMLButtonElement>('[data-action="confirm-upgrade"]');
    if (!slotKey || !titleEl || !levelEl || !previewEl || !prerequisiteEl || !btn) return;
    prerequisiteEl.textContent = "";
    prerequisiteEl.classList.add("hidden");

    const label = this.slotLabels[slotKey] ?? slotKey;
    titleEl.textContent = label;
    const building = this.buildingForSlot(slotKey);
    const level = building?.level ?? 0;
    const now = Date.now();
    const upgrading = (building?.upgrade_finish_at_ms ?? 0) > now;

    levelEl.textContent = level > 0 ? `当前 Lv${level}` : "未建造";

    if (upgrading) {
      previewEl.textContent = "升级进行中，见「队列」面板";
      btn.disabled = true;
      this.setFormError(null);
      return;
    }

    const session = this.getSession();
    if (!session) {
      previewEl.textContent = PANEL_STATE_LOADING_MESSAGE;
      previewEl.innerHTML = "";
      applyPanelStateChrome(previewEl as HTMLElement, "loading");
      btn.disabled = true;
      this.setFormError(null);
      return;
    }

    const preview = previewUpgradeCost(slotKey, level, this.wallet());
    if (!preview) {
      previewEl.textContent = "暂无升级配置";
      previewEl.innerHTML = "";
      previewEl.classList.remove(PANEL_STATE_CHROME_CLASS);
      previewEl.removeAttribute("data-panel-state");
      btn.disabled = true;
      this.setFormError(null);
      return;
    }

    previewEl.classList.remove(PANEL_STATE_CHROME_CLASS);
    previewEl.removeAttribute("data-panel-state");
    const costLine = formatBuildUpgradeCostLine(
      preview.targetLevel,
      preview.cost,
      this.wallet(),
      { timeSec: preview.timeSec },
    );
    previewEl.textContent = costLine.textLine;
    previewEl.innerHTML = costLine.htmlLine;
    const prerequisite = buildUpgradePrerequisiteHint(
      preview.buildingCfgId, preview.targetLevel, session.buildings,
    );
    prerequisiteEl.textContent = prerequisite ?? "";
    prerequisiteEl.classList.toggle("hidden", !prerequisite);
    const submitState = this.getSubmitState();
    btn.disabled = buildSubmitButtonDisabled(submitState, preview.canAfford && !prerequisite, false);
    btn.textContent = buildSubmitButtonLabel(submitState);
    if (submitState !== "error") {
      this.setFormError(preview.insufficientHint);
    }
  }

  private onClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn || btn.getAttribute("data-action") !== "confirm-upgrade") return;
    // State may have hydrated/changed since the last paint; never submit an old preview.
    this.render();
    const slotKey = this.selectedSlotKey;
    if (!slotKey || btn.disabled) return;
    const building = this.buildingForSlot(slotKey);
    const level = building?.level ?? 0;
    const preview = previewUpgradeCost(slotKey, level, this.wallet());
    if (!preview?.canAfford) {
      this.setFormError(preview?.insufficientHint ?? "资源不足");
      this.render();
      return;
    }
    this.setFormError(null);
    this.onUpgrade(slotKey, preview.buildingCfgId);
  }
}
