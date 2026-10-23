import type { MainCitySession } from "@/net/bootstrapSession";
import type { GatewayPort } from "@/net/GatewayClient";
import {
  applyMailClaimResult,
  formatHeroDetail,
  formatHeroLine,
  formatMailLine,
  formatRecruitTemplateLine,
  heroListLines,
  mailListLines,
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
  ) {}

  attach(): void {
    this.heroPanel = this.buildHeroPanel();
    this.mailPanel = this.buildMailPanel();
    this.mount.appendChild(this.heroPanel);
    this.mount.appendChild(this.mailPanel);
    this.heroPanel.addEventListener("click", (ev) => this.onHeroClick(ev));
    this.mailPanel.addEventListener("click", (ev) => this.onMailClick(ev));
    this.heroPanel.addEventListener("change", (ev) => this.onHeroChange(ev));
    this.mailPanel.addEventListener("change", (ev) => this.onMailChange(ev));
  }

  detach(): void {
    this.heroPanel?.remove();
    this.mailPanel?.remove();
  }

  toggleHero(): void {
    this.heroPanel.classList.toggle("hidden");
    if (!this.heroPanel.classList.contains("hidden")) {
      void this.refreshRecruitTemplates();
      void this.refreshHeroes();
    }
  }

  toggleMail(): void {
    this.mailPanel.classList.toggle("hidden");
    if (!this.mailPanel.classList.contains("hidden")) void this.refreshMail();
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
    el.className = "content-panel hidden";
    el.innerHTML = `
      <h3>邮件</h3>
      <p data-role="mail-hint">content.v1 收件箱；GM send-mail 或运营发奖后在此领取。</p>
      <button type="button" data-action="refresh-mail">刷新收件箱</button>
      <label>邮件 ID
        <input type="number" data-field="mail-id" min="1" value="1" />
      </label>
      <button type="button" data-action="mark-read">标为已读</button>
      <button type="button" data-action="claim-mail">领取附件</button>
      <ul class="mail-list" data-role="mail-list"></ul>
      <pre class="mail-body" data-role="mail-body"></pre>
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

  private renderMailList(): void {
    const ul = this.mailPanel.querySelector('[data-role="mail-list"]');
    const body = this.mailPanel.querySelector('[data-role="mail-body"]');
    if (!ul) return;
    ul.innerHTML = "";
    if (!this.mails.length) {
      const li = document.createElement("li");
      li.textContent = mailListLines([])[0];
      ul.appendChild(li);
    } else {
      for (const m of this.mails) {
        const li = document.createElement("li");
        li.textContent = formatMailLine(m);
        if (m.mail_id) {
          li.setAttribute("data-mail-id", String(m.mail_id));
          li.style.cursor = "pointer";
        }
        ul.appendChild(li);
      }
    }
    if (body) {
      const sel = this.mails.find((m) => m.mail_id === this.selectedMailId);
      body.textContent = sel?.body?.trim() || (sel ? `（无正文）` : "");
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

  private async recruitHero(): Promise<void> {
    const sid = this.serverId();
    const tpl = this.selectedTemplateId;
    const itemId = this.recruitItemId;
    if (!tpl) {
      this.onStatus("请先刷新并选择招募模板");
      return;
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
      await this.refreshHeroes();
      if (res.hero_id) {
        this.selectedHeroId = res.hero_id;
        await this.loadHeroDetail(res.hero_id);
      }
      this.onStatus(
        `招募成功 #${res.hero_id ?? "?"} ${res.template_cfg_id ?? tpl} Lv${res.level ?? 1} 忠诚${res.loyalty ?? 0}`,
      );
    } catch (e) {
      const err = e as Error & { code?: number };
      this.onStatus(err.code ? `招募失败(code=${err.code})：${err.message}` : err.message);
    }
  }

  private async refreshMail(): Promise<void> {
    const sid = this.serverId();
    this.onStatus("拉取邮件…");
    try {
      const res = (await this.gateway.listPlayerMail(sid)) as {
        mails?: MailRow[];
        total_count?: number;
      };
      this.mails = res.mails ?? [];
      this.renderMailList();
      this.onStatus(`邮件 ${this.mails.length}/${res.total_count ?? this.mails.length} 封`);
    } catch (e) {
      this.onStatus((e as Error).message);
    }
  }

  private async markMailRead(): Promise<void> {
    const sid = this.serverId();
    const mailId = this.selectedMailId;
    if (!mailId) {
      this.onStatus("请选择邮件");
      return;
    }
    this.onStatus(`标记已读 #${mailId}…`);
    try {
      const res = (await this.gateway.markPlayerMailRead(sid, mailId)) as { mail?: MailRow };
      if (res.mail) {
        this.mails = this.mails.map((m) => (m.mail_id === mailId ? { ...m, ...res.mail } : m));
        this.renderMailList();
      } else {
        await this.refreshMail();
      }
      this.onStatus("已标为已读");
    } catch (e) {
      this.onStatus((e as Error).message);
    }
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
    } catch (e) {
      const err = e as Error & { code?: number };
      this.onStatus(err.code ? `领取失败(code=${err.code})：${err.message}` : err.message);
    }
  }

  private onHeroChange(ev: Event): void {
    const t = ev.target as HTMLElement;
    if (t.getAttribute("data-field") === "template-select") {
      const id = Number((t as HTMLSelectElement).value) || 0;
      if (id) this.applyTemplateSelection(id);
    }
  }

  private onMailChange(ev: Event): void {
    const t = ev.target as HTMLElement;
    if (t.getAttribute("data-field") === "mail-id") {
      this.selectedMailId = Number((t as HTMLInputElement).value) || 0;
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
      if (id) {
        this.selectedMailId = id;
        const input = this.mailPanel.querySelector('[data-field="mail-id"]') as HTMLInputElement;
        if (input) input.value = String(id);
        this.renderMailList();
      }
      return;
    }
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "refresh-mail") void this.refreshMail();
    if (a === "mark-read") void this.markMailRead();
    if (a === "claim-mail") void this.claimMail();
  }
}
