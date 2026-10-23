import type { MainCitySession, ResourceWallet } from "@/net/bootstrapSession";
import { gatewayErrorMessage } from "@/net/contentFeedback";
import type { CityStateFetch } from "@/net/cityStateFetch";
import type { GatewayPort } from "@/net/GatewayClient";
import { bagFromListPlayerBagResponse, type BagStack } from "@/net/bagState";
import {
  DAILY_QUEST_CHAIN_ID,
  dailyQuestsFromListResponse,
  findDailyRecruitQuest,
  formatRecruitDailyFollowUpHint,
  shouldPromptDailyRecruitAfterRecruit,
  type DailyQuestRow,
} from "@/net/dailyQuestState";
import {
  applyMailClaimResult,
  formatHeroLine,
  formatMailClaimGrantedSummary,
  formatRecruitSuccessStatus,
  heroListLines,
  mergeRecruitTemplateOwnership,
  parseGetHeroDetailResponse,
  renderHeroDetailMarkup,
  MAIL_INBOX_FILTER_ALL,
  MAIL_INBOX_FILTER_UNREAD,
  mailHasUnclaimedAttachments,
  mailEmptyInboxMessage,
  mailIsUnread,
  mailTitle,
  parseRecruitTemplates,
  pickRecruitSelection,
  recruitTemplateListLines,
  type HeroDetail,
  type HeroSummary,
  type MailRow,
  type RecruitTemplatePreview,
} from "@/net/heroMailState";
import {
  mailInboxEmptyListClass,
  mailInboxLoadErrorListHint,
  MAIL_UNCLAIMED_BADGE_LABEL,
  mailListRowClassName,
  mailRowMetaLine,
  mailRowTitleLine,
} from "@/net/panelDensity";
import { mailUnreadSnapshotFromListResponse, pickFirstUnreadMailId } from "@/net/hudTodoBadge";
import { resolveMailBattleReportLink } from "@/net/mailBattleCrossLink";
import {
  compareRecruitAffordability,
  formatRecruitAffordabilitySummaryMarkup,
  recruitAffordabilityForTemplate,
  setRecruitAffordabilityErrorDisplay,
} from "@/net/recruitAffordability";

export class HeroMailPanels {
  private heroPanel!: HTMLElement;
  private mailPanel!: HTMLElement;
  private heroes: HeroSummary[] = [];
  private mails: MailRow[] = [];
  private mailFilter = MAIL_INBOX_FILTER_ALL;
  private mailListError = "";
  private selectedHeroId = 0;
  private selectedMailId = 0;
  private heroDetail: HeroDetail | null = null;
  private recruitTemplates: RecruitTemplatePreview[] = [];
  private selectedTemplateId = 0;
  private recruitItemId = 0;
  private recruitPool = "standard";
  private claimMailInflight = 0;

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private getSession: () => MainCitySession | null,
    private onSessionPatch: (patch: Partial<MainCitySession>) => void,
    private onStatus: (msg: string) => void,
    private onUnreadCount?: (count: number) => void,
    private readonly cityStateFetch?: CityStateFetch,
    private readonly onDailyRecruitLoop?: () => void | Promise<void>,
    private readonly onMailHudSnapshot?: (snap: { count: number; firstId: number }) => void,
    private readonly onOpenBattleReport?: (reportId: number | null) => void | Promise<void>,
  ) {}

  attach(): void {
    this.heroPanel = this.buildHeroPanel();
    this.mailPanel = this.buildMailPanel();
    this.mount.appendChild(this.heroPanel);
    this.mount.appendChild(this.mailPanel);
    this.heroPanel.addEventListener("click", (ev) => this.onHeroClick(ev));
    this.mailPanel.addEventListener("click", (ev) => this.onMailClick(ev));
    this.heroPanel.addEventListener("change", (ev) => this.onHeroChange(ev));
  }

  detach(): void {
    this.heroPanel?.remove();
    this.mailPanel?.remove();
  }

  /** 会话钱包/背包变更时刷新招募可负担对比（与 HUD 快照一致）。 */
  refreshRecruitAffordability(): void {
    if (!this.heroPanel || this.heroPanel.classList.contains("hidden")) return;
    this.renderTemplateList();
    this.renderHeroList();
  }

  private sessionEconomy(): { wallet: ResourceWallet; bag: BagStack[] } {
    const session = this.getSession();
    return { wallet: session?.wallet ?? {}, bag: session?.bag ?? [] };
  }

  private selectedRecruitTemplateRow(): RecruitTemplatePreview | undefined {
    return this.recruitTemplatesForDisplay().find((t) => t.template_cfg_id === this.selectedTemplateId);
  }

  private recruitAffordSummaryForHeroDetail(): string {
    const tplId = this.heroDetail?.template_cfg_id;
    if (!tplId) return "";
    const template = this.recruitTemplatesForDisplay().find((t) => t.template_cfg_id === tplId);
    if (!template) return "";
    const { wallet, bag } = this.sessionEconomy();
    return formatRecruitAffordabilitySummaryMarkup(template, wallet, bag);
  }

  getMailRoot(): HTMLElement {
    return this.mailPanel;
  }

  toggleHero(): void {
    this.heroPanel.classList.toggle("hidden");
    if (!this.heroPanel.classList.contains("hidden")) {
      void this.refreshRecruitTemplates();
      void this.refreshHeroes();
    }
  }

  isMailOpen(): boolean {
    return this.mailPanel != null && !this.mailPanel.classList.contains("hidden");
  }

  toggleMail(): void {
    this.mailPanel.classList.toggle("hidden");
    if (!this.mailPanel.classList.contains("hidden")) {
      this.onUnreadCount?.(0);
      void this.refreshMail();
    } else void this.syncUnreadBadge();
  }

  /** 仅打开邮件面板（不 toggle 关闭）。 */
  openMailPanel(): void {
    if (this.isMailOpen()) return;
    this.mailPanel.classList.remove("hidden");
    this.onUnreadCount?.(0);
    void this.refreshMail();
  }

  /** 战报深链：打开收件箱并高亮指定邮件（不自动领取附件）。 */
  openAndHighlightMail(mailId: number): void {
    this.mailPanel.classList.remove("hidden");
    this.onUnreadCount?.(0);
    this.mailFilter = MAIL_INBOX_FILTER_ALL;
    if (mailId > 0) this.selectedMailId = mailId;
    void this.refreshMail().then(() => this.focusHighlightedMail(mailId));
  }

  private async focusHighlightedMail(mailId: number): Promise<void> {
    if (mailId <= 0 || !this.mails.some((m) => m.mail_id === mailId)) return;
    await this.openMail(mailId);
    const row = this.mailPanel.querySelector(`li[data-mail-id="${mailId}"]`);
    row?.scrollIntoView?.({ block: "nearest" });
  }

  /** 待办角标深链：打开未读筛选并选中首封未读（id 来自轮询快照）。 */
  openFromTodoBadge(preferredMailId = 0): void {
    this.mailPanel.classList.remove("hidden");
    this.onUnreadCount?.(0);
    this.mailFilter = MAIL_INBOX_FILTER_UNREAD;
    if (preferredMailId > 0) this.selectedMailId = preferredMailId;
    void this.refreshMail().then(() => this.focusFirstUnreadMail(preferredMailId));
  }

  private async focusFirstUnreadMail(preferredMailId: number): Promise<void> {
    const fromList = pickFirstUnreadMailId(this.mails);
    const pickId =
      preferredMailId > 0 && this.mails.some((m) => m.mail_id === preferredMailId)
        ? preferredMailId
        : fromList;
    if (!pickId) return;
    await this.openMail(pickId);
    const row = this.mailPanel.querySelector(`li[data-mail-id="${pickId}"]`);
    row?.scrollIntoView?.({ block: "nearest" });
  }

  /** 底栏角标：拉取未读 total_count（与列表 filter 无关）。 */
  async syncUnreadBadge(): Promise<void> {
    if (this.isMailOpen()) {
      this.onUnreadCount?.(0);
      return;
    }
    if (!this.onUnreadCount) return;
    const snap = await this.pullMailUnreadSnapshot();
    this.onUnreadCount(snap.count);
  }

  private async pullMailUnreadSnapshot(): Promise<{ count: number; firstId: number }> {
    const sid = this.serverId();
    if (!sid) return { count: 0, firstId: 0 };
    try {
      const res = (await this.gateway.listPlayerMail(sid, {
        filter: MAIL_INBOX_FILTER_UNREAD,
        pageSize: 1,
        pageOffset: 0,
      })) as { mails?: MailRow[]; total_count?: number };
      return mailUnreadSnapshotFromListResponse(res);
    } catch {
      return { count: 0, firstId: 0 };
    }
  }

  private applyMailUnreadHud(snap: { count: number; firstId: number }): void {
    this.onMailHudSnapshot?.(snap);
    this.onUnreadCount?.(this.isMailOpen() ? 0 : snap.count);
  }

  private serverId(): number {
    const s = this.getSession();
    return s?.serverId ?? this.gateway.getBoundServerId() ?? s?.player?.server_id ?? 0;
  }

  private buildHeroPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel hidden";
    el.innerHTML = `
      <h3>将领</h3>
      <p data-role="hero-hint">hero.v1 列表/详情/招募；模板与消耗来自 ListRecruitTemplates。</p>
      <button type="button" data-action="refresh-heroes">刷新列表</button>
      <button type="button" data-action="refresh-templates">刷新招募模板</button>
      <label>招募模板
        <select data-field="template-select"><option value="">（先刷新模板）</option></select>
      </label>
      <p class="recruit-cost-preview" data-role="recruit-preview"></p>
      <button type="button" data-action="recruit-hero">招募</button>
      <p class="march-form-error-sibling hidden" data-role="recruit-form-error" role="alert"></p>
      <ul class="template-list" data-role="template-list"></ul>
      <ul class="hero-list" data-role="hero-list"></ul>
      <div class="hero-detail" data-role="hero-detail"></div>
    `;
    return el;
  }

  private buildMailPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel mail-inbox-panel hidden";
    el.dataset.centerPanel = "mail";
    el.innerHTML = `
      <h3>邮件</h3>
      <p class="mail-inbox-hint" data-role="mail-hint">content.v1 收件箱；点开自动标已读，有附件可一键领取。</p>
      <div class="mail-inbox-toolbar">
        <button type="button" class="mail-filter-btn art-btn-primary art-btn-primary-full selected" data-action="mail-filter-all">全部</button>
        <button type="button" class="mail-filter-btn art-btn-primary art-btn-primary-full" data-action="mail-filter-unread">未读</button>
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="refresh-mail">刷新</button>
      </div>
      <p class="mail-inbox-status" data-role="mail-status"></p>
      <ul class="mail-list" data-role="mail-list"></ul>
      <div class="mail-detail hidden" data-role="mail-detail">
        <h4 class="mail-detail-title" data-role="mail-detail-title"></h4>
        <pre class="mail-body" data-role="mail-body"></pre>
        <button type="button" class="art-btn-primary art-btn-primary-full hidden" data-action="claim-mail">领取附件</button>
        <button type="button" class="art-btn-primary art-btn-primary-full hidden mail-cross-link-btn" data-action="mail-open-battle-report">查看战报</button>
      </div>
    `;
    return el;
  }

  private renderHeroList(): void {
    const ul = this.heroPanel.querySelector('[data-role="hero-list"]');
    const detailEl = this.heroPanel.querySelector('[data-role="hero-detail"]');
    if (!ul) return;
    ul.innerHTML = "";
    if (!this.heroes.length) {
      const li = document.createElement("li");
      li.textContent = heroListLines([])[0];
      ul.appendChild(li);
    } else {
      for (const h of this.heroes) {
        const li = document.createElement("li");
        li.textContent = formatHeroLine(h);
        if (h.hero_id) {
          li.setAttribute("data-hero-id", String(h.hero_id));
          li.style.cursor = "pointer";
          if (h.hero_id === this.selectedHeroId) li.classList.add("selected");
        }
        ul.appendChild(li);
      }
    }
    if (detailEl) {
      detailEl.innerHTML = this.selectedHeroId
        ? renderHeroDetailMarkup(this.heroDetail, this.recruitAffordSummaryForHeroDetail())
        : renderHeroDetailMarkup(null);
    }
  }

  private recruitTemplatesForDisplay(): RecruitTemplatePreview[] {
    return mergeRecruitTemplateOwnership(this.recruitTemplates, this.heroes);
  }

  private renderTemplateList(): void {
    const ul = this.heroPanel.querySelector('[data-role="template-list"]');
    const sel = this.heroPanel.querySelector('[data-field="template-select"]') as HTMLSelectElement;
    const preview = this.heroPanel.querySelector('[data-role="recruit-preview"]');
    if (!ul || !sel) return;
    ul.innerHTML = "";
    sel.innerHTML = "";
    const displayTemplates = this.recruitTemplatesForDisplay();
    const lines = recruitTemplateListLines(displayTemplates);
    if (!displayTemplates.length) {
      const li = document.createElement("li");
      li.textContent = lines[0];
      ul.appendChild(li);
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "（无模板）";
      sel.appendChild(opt);
      if (preview) preview.textContent = "";
      return;
    }
    const { wallet, bag } = this.sessionEconomy();
    for (const t of displayTemplates) {
      const li = document.createElement("li");
      const { primary, secondary } = recruitAffordabilityForTemplate(t, wallet, bag);
      const primarySpan = document.createElement("span");
      primarySpan.className = "recruit-afford-primary";
      primarySpan.textContent = primary;
      const secondarySpan = document.createElement("span");
      secondarySpan.className = "recruit-afford-secondary";
      secondarySpan.textContent = secondary;
      li.appendChild(primarySpan);
      li.appendChild(secondarySpan);
      if (t.already_owned) li.classList.add("recruit-owned");
      if (t.template_cfg_id) {
        li.setAttribute("data-template-id", String(t.template_cfg_id));
        li.style.cursor = "pointer";
        if (t.template_cfg_id === this.selectedTemplateId) li.classList.add("selected");
      }
      ul.appendChild(li);
      const opt = document.createElement("option");
      opt.value = String(t.template_cfg_id ?? 0);
      const ownedTag = t.already_owned ? " · 已招募" : "";
      opt.textContent = `#${t.template_cfg_id} ${t.template_name ?? ""} · 稀有${t.rarity ?? "?"}${ownedTag}`;
      sel.appendChild(opt);
    }
    const pickId = this.selectedTemplateId || displayTemplates[0]?.template_cfg_id || 0;
    if (pickId) sel.value = String(pickId);
    this.applyTemplateSelection(pickId);
  }

  private applyTemplateSelection(templateCfgId: number): void {
    const displayTemplates = this.recruitTemplatesForDisplay();
    const row = displayTemplates.find((t) => t.template_cfg_id === templateCfgId);
    const pick = pickRecruitSelection(this.recruitTemplates, templateCfgId);
    if (pick) {
      this.selectedTemplateId = pick.templateCfgId;
      this.recruitItemId = pick.itemCfgId;
      this.recruitPool = pick.pool;
    }
    const preview = this.heroPanel.querySelector('[data-role="recruit-preview"]');
    if (preview) {
      if (row) {
        const { wallet, bag } = this.sessionEconomy();
        const { primary, secondary } = recruitAffordabilityForTemplate(row, wallet, bag);
        preview.textContent = `${primary} — ${secondary}`;
      } else {
        preview.textContent = this.recruitTemplates.length ? "请选择模板" : "";
      }
    }
    this.syncRecruitButtonState(row);
    const ul = this.heroPanel.querySelector('[data-role="template-list"]');
    ul?.querySelectorAll("li[data-template-id]").forEach((li) => {
      li.classList.toggle("selected", Number(li.getAttribute("data-template-id")) === templateCfgId);
    });
    const sel = this.heroPanel.querySelector('[data-field="template-select"]') as HTMLSelectElement;
    if (sel && templateCfgId) sel.value = String(templateCfgId);
    this.renderHeroList();
  }

  private syncRecruitButtonState(templateRow: RecruitTemplatePreview | undefined): void {
    const btn = this.heroPanel.querySelector('[data-action="recruit-hero"]') as HTMLButtonElement | null;
    if (!btn) return;
    if (!templateRow) {
      btn.disabled = true;
      setRecruitAffordabilityErrorDisplay(this.heroPanel, null);
      return;
    }
    const { wallet, bag } = this.sessionEconomy();
    const afford = compareRecruitAffordability(wallet, templateRow, bag);
    btn.disabled = !afford.canAfford;
    setRecruitAffordabilityErrorDisplay(this.heroPanel, afford.insufficientReason);
  }

  private setMailFilterButtons(): void {
    const allBtn = this.mailPanel.querySelector('[data-action="mail-filter-all"]');
    const unreadBtn = this.mailPanel.querySelector('[data-action="mail-filter-unread"]');
    allBtn?.classList.toggle("selected", this.mailFilter === MAIL_INBOX_FILTER_ALL);
    unreadBtn?.classList.toggle("selected", this.mailFilter === MAIL_INBOX_FILTER_UNREAD);
  }

  private renderMailList(): void {
    const ul = this.mailPanel.querySelector('[data-role="mail-list"]');
    const statusEl = this.mailPanel.querySelector('[data-role="mail-status"]');
    const detailWrap = this.mailPanel.querySelector('[data-role="mail-detail"]');
    const titleEl = this.mailPanel.querySelector('[data-role="mail-detail-title"]');
    const body = this.mailPanel.querySelector('[data-role="mail-body"]');
    const claimBtn = this.mailPanel.querySelector('[data-action="claim-mail"]');
    const battleBtn = this.mailPanel.querySelector(
      '[data-action="mail-open-battle-report"]',
    ) as HTMLButtonElement | null;
    if (!ul) return;
    this.setMailFilterButtons();
    ul.innerHTML = "";
    if (statusEl) {
      statusEl.textContent = this.mailListError;
      statusEl.classList.toggle("is-error", !!this.mailListError);
    }
    if (!this.mails.length) {
      const li = document.createElement("li");
      li.className = mailInboxEmptyListClass();
      li.textContent = this.mailListError
        ? mailInboxLoadErrorListHint()
        : mailEmptyInboxMessage(this.mailFilter);
      ul.appendChild(li);
    } else {
      for (const m of this.mails) {
        const li = document.createElement("li");
        if (m.mail_id) {
          li.setAttribute("data-mail-id", String(m.mail_id));
          if (m.mail_id === this.selectedMailId) li.classList.add("selected");
        }
        for (const cls of mailListRowClassName(m).split(/\s+/).filter(Boolean)) {
          li.classList.add(cls);
        }
        const titleSpan = document.createElement("span");
        titleSpan.className = "mail-row-title";
        titleSpan.textContent = mailRowTitleLine(m);
        if (mailHasUnclaimedAttachments(m)) {
          const badge = document.createElement("span");
          badge.className = "mail-unclaimed-badge";
          badge.textContent = MAIL_UNCLAIMED_BADGE_LABEL;
          titleSpan.appendChild(badge);
        }
        const summarySpan = document.createElement("span");
        summarySpan.className = "mail-row-summary";
        summarySpan.textContent = mailRowMetaLine(m);
        if (mailHasUnclaimedAttachments(m)) summarySpan.classList.add("mail-row-meta-attach");
        li.appendChild(titleSpan);
        li.appendChild(summarySpan);
        ul.appendChild(li);
      }
    }
    const sel = this.mails.find((m) => m.mail_id === this.selectedMailId) ?? null;
    if (detailWrap) detailWrap.classList.toggle("hidden", !sel);
    if (titleEl) titleEl.textContent = sel ? mailTitle(sel) : "";
    if (body) {
      body.textContent = sel?.body?.trim() || (sel ? "（无正文）" : "");
    }
    if (claimBtn) {
      const show = sel && mailHasUnclaimedAttachments(sel);
      claimBtn.classList.toggle("hidden", !show);
      claimBtn.classList.toggle("mail-claim-highlight", !!(show && sel && !mailIsUnread(sel)));
      if (claimBtn instanceof HTMLButtonElement) {
        claimBtn.disabled = this.claimMailInflight > 0 && this.claimMailInflight === this.selectedMailId;
      }
    }
    if (battleBtn) {
      const link = sel
        ? resolveMailBattleReportLink(mailTitle(sel), sel.body ?? "")
        : { show: false, reportId: null };
      const showBattle = link.show && !!this.onOpenBattleReport;
      battleBtn.classList.toggle("hidden", !showBattle);
      if (link.reportId != null) battleBtn.dataset.reportId = String(link.reportId);
      else battleBtn.removeAttribute("data-report-id");
    }
  }

  private async refreshHeroes(): Promise<void> {
    const sid = this.serverId();
    this.onStatus("拉取将领…");
    try {
      const res = (await this.gateway.listPlayerHeroes(sid)) as {
        heroes?: HeroSummary[];
        total_count?: number;
      };
      this.heroes = res.heroes ?? [];
      this.renderHeroList();
      this.renderTemplateList();
      this.onStatus(`将领 ${this.heroes.length}/${res.total_count ?? this.heroes.length} 名`);
    } catch (e) {
      this.onStatus((e as Error).message);
    }
  }

  private async loadHeroDetail(heroId: number): Promise<void> {
    const sid = this.serverId();
    this.selectedHeroId = heroId;
    this.onStatus(`将领详情 #${heroId}…`);
    try {
      const res = await this.gateway.getHeroDetail(sid, heroId);
      this.heroDetail = parseGetHeroDetailResponse(res);
      this.renderHeroList();
      this.onStatus("详情已加载");
    } catch (e) {
      this.heroDetail = null;
      this.renderHeroList();
      this.onStatus((e as Error).message);
    }
  }

  private async refreshRecruitTemplates(): Promise<void> {
    const sid = this.serverId();
    this.onStatus("拉取招募模板…");
    try {
      const res = await this.gateway.listRecruitTemplates(sid, { pageSize: 50 });
      const { templates, totalCount } = parseRecruitTemplates(res as { templates?: RecruitTemplatePreview[]; total_count?: number });
      this.recruitTemplates = templates;
      const prev = this.selectedTemplateId;
      this.renderTemplateList();
      if (!prev && templates.length) {
        const pick = pickRecruitSelection(templates);
        if (pick) this.applyTemplateSelection(pick.templateCfgId);
      }
      this.onStatus(`招募模板 ${templates.length}/${totalCount} 条`);
    } catch (e) {
      this.recruitTemplates = [];
      this.renderTemplateList();
      this.onStatus((e as Error).message);
    }
  }

  private async fetchDailyRecruitRow(): Promise<DailyQuestRow | null> {
    const sid = this.serverId();
    const res = await this.gateway.listPlayerQuests(sid, {
      chainId: DAILY_QUEST_CHAIN_ID,
      includeCompleted: true,
    });
    const rows = dailyQuestsFromListResponse(res as { quests?: DailyQuestRow[] });
    return findDailyRecruitQuest(rows);
  }

  private async syncEconomyAfterRecruit(): Promise<void> {
    const session = this.getSession();
    if (!session) return;
    let bag: BagStack[] = session.bag;
    let wallet: ResourceWallet = session.wallet;
    const sid = this.serverId();
    try {
      const bagRes = (await this.gateway.listPlayerBag(sid)) as {
        items?: { item_cfg_id?: number; quantity?: number }[];
      };
      bag = bagFromListPlayerBagResponse(bagRes.items);
    } catch {
      /* 保留会话背包 */
    }
    if (this.cityStateFetch) {
      const state = await this.cityStateFetch.fetch();
      if (state?.wallet) wallet = state.wallet;
    } else {
      try {
        const state = (await this.gateway.getCityState(session.cityId)) as { wallet?: ResourceWallet };
        if (state.wallet) wallet = state.wallet;
      } catch {
        /* 保留会话钱包 */
      }
    }
    this.onSessionPatch({ bag, wallet });
  }

  private async recruitHero(): Promise<void> {
    const sid = this.serverId();
    const tpl = this.selectedTemplateId;
    const itemId = this.recruitItemId;
    const templateRow = this.recruitTemplatesForDisplay().find((t) => t.template_cfg_id === tpl);
    if (!tpl) {
      this.onStatus("请先刷新并选择招募模板");
      return;
    }
    const { wallet, bag } = this.sessionEconomy();
    const afford = compareRecruitAffordability(wallet, templateRow ?? {}, bag);
    if (!afford.canAfford) {
      setRecruitAffordabilityErrorDisplay(this.heroPanel, afford.insufficientReason);
      this.onStatus(afford.insufficientReason ?? "资源不足");
      return;
    }
    setRecruitAffordabilityErrorDisplay(this.heroPanel, null);
    let dailyBefore: DailyQuestRow | null = null;
    try {
      dailyBefore = await this.fetchDailyRecruitRow();
    } catch {
      /* 日常列表失败不阻断招募 */
    }
    this.onStatus(`招募模板 ${tpl}…`);
    try {
      const res = (await this.gateway.recruitHero(sid, tpl, {
        itemCfgId: itemId,
        pool: this.recruitPool,
      })) as {
        hero_id?: number;
        template_cfg_id?: number;
        level?: number;
        loyalty?: number;
      };
      await this.syncEconomyAfterRecruit();
      await this.refreshHeroes();
      if (res.hero_id) {
        this.selectedHeroId = res.hero_id;
        await this.loadHeroDetail(res.hero_id);
      }
      let status = formatRecruitSuccessStatus(res, templateRow);
      try {
        const dailyAfter = await this.fetchDailyRecruitRow();
        if (shouldPromptDailyRecruitAfterRecruit(dailyBefore, dailyAfter)) {
          await this.onDailyRecruitLoop?.();
          status = `${status} · ${formatRecruitDailyFollowUpHint()}`;
        }
      } catch {
        /* 忽略日常刷新失败 */
      }
      setRecruitAffordabilityErrorDisplay(this.heroPanel, null);
      this.onStatus(status);
    } catch (e) {
      const err = e as Error & { code?: number };
      const msg = err.code ? `招募失败(code=${err.code})：${err.message}` : err.message;
      this.onStatus(msg);
      setRecruitAffordabilityErrorDisplay(this.heroPanel, err.message);
    }
  }

  private refreshMail(): Promise<void> {
    return this.refreshMailInner();
  }

  private async refreshMailInner(): Promise<void> {
    const sid = this.serverId();
    this.onStatus("拉取邮件…");
    this.mailListError = "";
    try {
      const res = (await this.gateway.listPlayerMail(sid, {
        filter: this.mailFilter,
        pageSize: 50,
      })) as {
        mails?: MailRow[];
        total_count?: number;
      };
      this.mails = res.mails ?? [];
      if (!this.selectedMailId && this.mails[0]?.mail_id) {
        this.selectedMailId = this.mails[0].mail_id!;
      } else if (
        this.selectedMailId &&
        !this.mails.some((m) => m.mail_id === this.selectedMailId)
      ) {
        this.selectedMailId = this.mails[0]?.mail_id ?? 0;
      }
      this.renderMailList();
      const total = res.total_count ?? this.mails.length;
      const filterLabel = this.mailFilter === MAIL_INBOX_FILTER_UNREAD ? "未读" : "全部";
      this.onStatus(`邮件（${filterLabel}）${this.mails.length}/${total} 封`);
      if (this.isMailOpen()) this.onUnreadCount?.(0);
      else void this.syncUnreadBadge();
    } catch (e) {
      this.mailListError = (e as Error).message || "加载收件箱失败，请稍后重试";
      this.mails = [];
      this.renderMailList();
      this.onStatus(this.mailListError);
    }
  }

  private async markMailRead(mailId: number): Promise<void> {
    const sid = this.serverId();
    const row = this.mails.find((m) => m.mail_id === mailId);
    if (!row || !mailIsUnread(row)) return;
    try {
      const res = (await this.gateway.markPlayerMailRead(sid, mailId)) as { mail?: MailRow };
      if (res.mail) {
        this.mails = this.mails.map((m) => (m.mail_id === mailId ? { ...m, ...res.mail } : m));
        if (this.mailFilter === MAIL_INBOX_FILTER_UNREAD) {
          this.mails = this.mails.filter((m) => m.mail_id !== mailId);
          if (!this.mails.some((m) => m.mail_id === this.selectedMailId)) {
            this.selectedMailId = this.mails[0]?.mail_id ?? 0;
          }
        }
        this.renderMailList();
      } else {
        await this.refreshMail();
      }
      void this.syncUnreadBadge();
    } catch (e) {
      this.onStatus((e as Error).message);
    }
  }

  private async openMail(mailId: number): Promise<void> {
    this.selectedMailId = mailId;
    this.renderMailList();
    await this.markMailRead(mailId);
  }

  private async syncBagFromServer(): Promise<BagStack[] | null> {
    const session = this.getSession();
    if (!session) return null;
    const sid = this.serverId();
    try {
      const bagRes = (await this.gateway.listPlayerBag(sid)) as {
        items?: { item_cfg_id?: number; quantity?: number }[];
      };
      const bag = bagFromListPlayerBagResponse(bagRes.items);
      this.onSessionPatch({ bag });
      return bag;
    } catch {
      return null;
    }
  }

  private async claimMail(): Promise<void> {
    const sid = this.serverId();
    const mailId = this.selectedMailId;
    if (!mailId) {
      this.onStatus("请选择邮件");
      return;
    }
    if (this.claimMailInflight) return;
    this.mailListError = "";
    this.claimMailInflight = mailId;
    this.renderMailList();
    this.onStatus(`领取附件 #${mailId}…`);
    try {
      const res = (await this.gateway.claimPlayerMailAttachments(sid, mailId)) as {
        mail?: MailRow;
        granted?: {
          items?: { item_cfg_id?: number; quantity?: number }[];
          resources?: ResourceWallet;
        };
        wallet_after?: MainCitySession["wallet"];
        bag_items?: { item_cfg_id?: number; quantity?: number }[];
      };
      const session = this.getSession();
      if (session) {
        const patch = applyMailClaimResult(this.mails, mailId, res, session);
        this.applyMailsAfterClaim(patch.mails, mailId);
        this.onSessionPatch({ bag: patch.bag, wallet: patch.wallet });
      } else if (res.mail) {
        this.applyMailsAfterClaim(
          this.mails.map((m) => (m.mail_id === mailId ? { ...m, ...res.mail, has_unclaimed_attachments: false } : m)),
          mailId,
        );
      }
      this.renderMailList();
      await this.syncBagFromServer();
      const snap = await this.pullMailUnreadSnapshot();
      this.applyMailUnreadHud(snap);
      const summary = formatMailClaimGrantedSummary(res.granted);
      this.onStatus(`领取成功：${summary}`);
    } catch (e) {
      const msg = gatewayErrorMessage(e);
      this.mailListError = msg;
      this.onStatus(msg);
    } finally {
      this.claimMailInflight = 0;
      this.renderMailList();
    }
  }

  /** 领取后局部更新列表行；未读筛选下已读/已领行移出当前页。 */
  private applyMailsAfterClaim(nextMails: MailRow[], mailId: number): void {
    const updated = nextMails.find((m) => m.mail_id === mailId);
    if (this.mailFilter === MAIL_INBOX_FILTER_UNREAD && updated && !mailIsUnread(updated)) {
      this.mails = nextMails.filter((m) => m.mail_id !== mailId);
      if (!this.mails.some((m) => m.mail_id === this.selectedMailId)) {
        this.selectedMailId = this.mails[0]?.mail_id ?? 0;
      }
      return;
    }
    this.mails = nextMails;
  }

  private onHeroChange(ev: Event): void {
    const t = ev.target as HTMLElement;
    if (t.getAttribute("data-field") === "template-select") {
      const id = Number((t as HTMLSelectElement).value) || 0;
      if (id) this.applyTemplateSelection(id);
    }
  }

  private onHeroClick(ev: Event): void {
    const tplLi = (ev.target as HTMLElement).closest("li[data-template-id]");
    if (tplLi) {
      const id = Number(tplLi.getAttribute("data-template-id"));
      if (id) this.applyTemplateSelection(id);
      return;
    }
    const li = (ev.target as HTMLElement).closest("li[data-hero-id]");
    if (li) {
      const id = Number(li.getAttribute("data-hero-id"));
      if (id) void this.loadHeroDetail(id);
      return;
    }
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "refresh-heroes") void this.refreshHeroes();
    if (a === "refresh-templates") void this.refreshRecruitTemplates();
    if (a === "recruit-hero") void this.recruitHero();
  }

  private onMailClick(ev: Event): void {
    const li = (ev.target as HTMLElement).closest("li[data-mail-id]");
    if (li) {
      const id = Number(li.getAttribute("data-mail-id"));
      if (id) void this.openMail(id);
      return;
    }
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "refresh-mail") void this.refreshMail();
    if (a === "mail-filter-all") {
      this.mailFilter = MAIL_INBOX_FILTER_ALL;
      void this.refreshMail();
    }
    if (a === "mail-filter-unread") {
      this.mailFilter = MAIL_INBOX_FILTER_UNREAD;
      void this.refreshMail();
    }
    if (a === "claim-mail") void this.claimMail();
    if (a === "mail-open-battle-report") {
      const reportRaw = btn.dataset.reportId;
      const reportId = reportRaw ? Number(reportRaw) : 0;
      void this.onOpenBattleReport?.(reportId > 0 ? reportId : null);
    }
  }
}
