import type { MainCitySession, ResourceWallet } from "@/net/bootstrapSession";
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
  formatHeroDetail,
  formatHeroLine,
  formatRecruitSuccessStatus,
  formatRecruitTemplateLine,
  heroListLines,
  MAIL_INBOX_FILTER_ALL,
  MAIL_INBOX_FILTER_UNREAD,
  mailCanClaimAttachments,
  mailEmptyInboxMessage,
  mailIsUnread,
  mailListSummary,
  mailTitle,
  parseRecruitTemplates,
  pickRecruitSelection,
  recruitTemplateListLines,
  type HeroDetail,
  type HeroSummary,
  type MailRow,
  type RecruitTemplatePreview,
} from "@/net/heroMailState";

export class HeroMailPanels {
  private heroPanel!: HTMLElement;
  private mailPanel!: HTMLElement;
  private heroes: HeroSummary[] = [];
  private mails: MailRow[] = [];
  private mailFilter = MAIL_INBOX_FILTER_ALL;
  private mailListError = "";
  private selectedHeroId = 0;
  private selectedMailId = 0;
  private detailText = "";
  private recruitTemplates: RecruitTemplatePreview[] = [];
  private selectedTemplateId = 0;
  private recruitItemId = 0;
  private recruitPool = "standard";

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private getSession: () => MainCitySession | null,
    private onSessionPatch: (patch: Partial<MainCitySession>) => void,
    private onStatus: (msg: string) => void,
    private onUnreadCount?: (count: number) => void,
    private readonly cityStateFetch?: CityStateFetch,
    private readonly onDailyRecruitLoop?: () => void | Promise<void>,
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

  /** 底栏角标：拉取未读 total_count（与列表 filter 无关）。 */
  async syncUnreadBadge(): Promise<void> {
    if (this.isMailOpen()) {
      this.onUnreadCount?.(0);
      return;
    }
    const sid = this.serverId();
    if (!sid || !this.onUnreadCount) return;
    try {
      const res = (await this.gateway.listPlayerMail(sid, {
        filter: MAIL_INBOX_FILTER_UNREAD,
        pageSize: 1,
        pageOffset: 0,
      })) as { total_count?: number };
      this.onUnreadCount(res.total_count ?? 0);
    } catch {
      this.onUnreadCount(0);
    }
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
      <ul class="template-list" data-role="template-list"></ul>
      <ul class="hero-list" data-role="hero-list"></ul>
      <pre class="hero-detail" data-role="hero-detail"></pre>
    `;
    return el;
  }

  private buildMailPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel mail-inbox-panel hidden";
    el.innerHTML = `
      <h3>邮件</h3>
      <p class="mail-inbox-hint" data-role="mail-hint">content.v1 收件箱；点开自动标已读，有附件可一键领取。</p>
      <div class="mail-inbox-toolbar">
        <button type="button" class="mail-filter-btn selected" data-action="mail-filter-all">全部</button>
        <button type="button" class="mail-filter-btn" data-action="mail-filter-unread">未读</button>
        <button type="button" data-action="refresh-mail">刷新</button>
      </div>
      <p class="mail-inbox-status" data-role="mail-status"></p>
      <ul class="mail-list" data-role="mail-list"></ul>
      <div class="mail-detail hidden" data-role="mail-detail">
        <h4 class="mail-detail-title" data-role="mail-detail-title"></h4>
        <pre class="mail-body" data-role="mail-body"></pre>
        <button type="button" class="hidden" data-action="claim-mail">领取附件</button>
      </div>
    `;
    return el;
  }

  private renderHeroList(): void {
    const ul = this.heroPanel.querySelector('[data-role="hero-list"]');
    const pre = this.heroPanel.querySelector('[data-role="hero-detail"]');
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
    if (pre) pre.textContent = this.detailText;
  }

  private renderTemplateList(): void {
    const ul = this.heroPanel.querySelector('[data-role="template-list"]');
    const sel = this.heroPanel.querySelector('[data-field="template-select"]') as HTMLSelectElement;
    const preview = this.heroPanel.querySelector('[data-role="recruit-preview"]');
    if (!ul || !sel) return;
    ul.innerHTML = "";
    sel.innerHTML = "";
    const lines = recruitTemplateListLines(this.recruitTemplates);
    if (!this.recruitTemplates.length) {
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
    for (const t of this.recruitTemplates) {
      const li = document.createElement("li");
      li.textContent = formatRecruitTemplateLine(t);
      if (t.template_cfg_id) {
        li.setAttribute("data-template-id", String(t.template_cfg_id));
        li.style.cursor = "pointer";
      }
      ul.appendChild(li);
      const opt = document.createElement("option");
      opt.value = String(t.template_cfg_id ?? 0);
      opt.textContent = `#${t.template_cfg_id} ${t.template_name ?? ""} · 稀有${t.rarity ?? "?"}`;
      sel.appendChild(opt);
    }
    const pickId = this.selectedTemplateId || this.recruitTemplates[0]?.template_cfg_id || 0;
    if (pickId) sel.value = String(pickId);
    this.applyTemplateSelection(pickId);
  }

  private applyTemplateSelection(templateCfgId: number): void {
    const row = this.recruitTemplates.find((t) => t.template_cfg_id === templateCfgId);
    const pick = pickRecruitSelection(this.recruitTemplates, templateCfgId);
    if (pick) {
      this.selectedTemplateId = pick.templateCfgId;
      this.recruitItemId = pick.itemCfgId;
      this.recruitPool = pick.pool;
    }
    const preview = this.heroPanel.querySelector('[data-role="recruit-preview"]');
    if (preview) {
      preview.textContent = row
        ? `消耗预览：${formatRecruitTemplateLine(row)}`
        : this.recruitTemplates.length
          ? "请选择模板"
          : "";
    }
    const sel = this.heroPanel.querySelector('[data-field="template-select"]') as HTMLSelectElement;
    if (sel && templateCfgId) sel.value = String(templateCfgId);
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
    if (!ul) return;
    this.setMailFilterButtons();
    ul.innerHTML = "";
    if (statusEl) {
      statusEl.textContent = this.mailListError;
      statusEl.classList.toggle("is-error", !!this.mailListError);
    }
    if (!this.mails.length) {
      const li = document.createElement("li");
      li.className = "mail-empty";
      li.textContent = this.mailListError
        ? "请点「刷新」重试"
        : mailEmptyInboxMessage(this.mailFilter);
      ul.appendChild(li);
    } else {
      for (const m of this.mails) {
        const li = document.createElement("li");
        if (m.mail_id) {
          li.setAttribute("data-mail-id", String(m.mail_id));
          if (m.mail_id === this.selectedMailId) li.classList.add("selected");
          if (mailIsUnread(m)) li.classList.add("unread");
        }
        const titleSpan = document.createElement("span");
        titleSpan.className = "mail-row-title";
        titleSpan.textContent = mailTitle(m);
        const summarySpan = document.createElement("span");
        summarySpan.className = "mail-row-summary";
        summarySpan.textContent = mailListSummary(m);
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
      const show = sel && mailCanClaimAttachments(sel);
      claimBtn.classList.toggle("hidden", !show);
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
      this.detailText = formatHeroDetail(res as HeroDetail);
      this.renderHeroList();
      this.onStatus("详情已加载");
    } catch (e) {
      this.detailText = "";
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
    const templateRow = this.recruitTemplates.find((t) => t.template_cfg_id === tpl);
    if (!tpl) {
      this.onStatus("请先刷新并选择招募模板");
      return;
    }
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
      this.onStatus(status);
    } catch (e) {
      const err = e as Error & { code?: number };
      this.onStatus(err.code ? `招募失败(code=${err.code})：${err.message}` : err.message);
    }
  }

  private async refreshMail(): Promise<void> {
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

  private async claimMail(): Promise<void> {
    const sid = this.serverId();
    const mailId = this.selectedMailId;
    if (!mailId) {
      this.onStatus("请选择邮件");
      return;
    }
    this.onStatus(`领取附件 #${mailId}…`);
    try {
      const res = (await this.gateway.claimPlayerMailAttachments(sid, mailId)) as {
        mail?: MailRow;
        granted?: { items?: { item_cfg_id?: number; quantity?: number }[] };
        wallet_after?: MainCitySession["wallet"];
        bag_items?: { item_cfg_id?: number; quantity?: number }[];
      };
      const session = this.getSession();
      if (session) {
        const patch = applyMailClaimResult(this.mails, mailId, res, session);
        this.mails = patch.mails;
        this.onSessionPatch({ bag: patch.bag, wallet: patch.wallet });
      } else if (res.mail) {
        this.mails = this.mails.map((m) => (m.mail_id === mailId ? { ...m, ...res.mail } : m));
      }
      this.renderMailList();
      this.onStatus("附件已领取");
      void this.syncUnreadBadge();
    } catch (e) {
      const err = e as Error & { code?: number };
      const msg = err.code ? `领取失败(code=${err.code})：${err.message}` : err.message;
      this.onStatus(msg);
      const statusEl = this.mailPanel.querySelector('[data-role="mail-status"]');
      if (statusEl) {
        statusEl.textContent = msg;
        statusEl.classList.add("is-error");
      }
    }
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
  }
}
