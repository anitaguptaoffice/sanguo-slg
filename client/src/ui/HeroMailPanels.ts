import type { MainCitySession } from "@/net/bootstrapSession";
import type { GatewayPort } from "@/net/GatewayClient";
import {
  DEFAULT_RECRUIT_TEMPLATE_ID,
  HERO_RECRUIT_SCROLL_ID,
  applyMailClaimResult,
  formatHeroDetail,
  formatHeroLine,
  formatMailLine,
  heroListLines,
  mailListLines,
  type HeroDetail,
  type HeroSummary,
  type MailRow,
} from "@/net/heroMailState";
import { itemLabel } from "@/net/contentFormat";

export class HeroMailPanels {
  private heroPanel!: HTMLElement;
  private mailPanel!: HTMLElement;
  private heroes: HeroSummary[] = [];
  private mails: MailRow[] = [];
  private selectedHeroId = 0;
  private selectedMailId = 0;
  private detailText = "";
  private selectedTemplateId = DEFAULT_RECRUIT_TEMPLATE_ID;
  private recruitItemId = HERO_RECRUIT_SCROLL_ID;

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
    if (!this.heroPanel.classList.contains("hidden")) void this.refreshHeroes();
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
      <p data-role="hero-hint">hero.v1 列表/详情/招募；招募消耗以服务端为准（名册 ${itemLabel(HERO_RECRUIT_SCROLL_ID)}）。</p>
      <button type="button" data-action="refresh-heroes">刷新列表</button>
      <label>招募模板
        <input type="number" data-field="template-id" min="1001" value="${DEFAULT_RECRUIT_TEMPLATE_ID}" />
      </label>
      <label>消耗道具
        <input type="number" data-field="recruit-item" min="0" value="${HERO_RECRUIT_SCROLL_ID}" />
      </label>
      <button type="button" data-action="recruit-hero">招募</button>
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
    const idInput = this.heroPanel.querySelector('[data-field="template-id"]');
    this.onStatus(`将领详情 #${heroId}…`);
    try {
      const res = (await this.gateway.getHeroDetail(sid, heroId)) as HeroDetail;
      this.detailText = formatHeroDetail(res);
      this.renderHeroList();
      this.onStatus("详情已加载");
    } catch (e) {
      this.detailText = "";
      this.renderHeroList();
      this.onStatus((e as Error).message);
    }
  }

  private async recruitHero(): Promise<void> {
    const sid = this.serverId();
    const tpl = this.selectedTemplateId;
    const itemId = this.recruitItemId;
    this.onStatus(`招募模板 ${tpl}…`);
    try {
      const res = (await this.gateway.recruitHero(sid, tpl, { itemCfgId: itemId, pool: "standard" })) as {
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
    if (t.getAttribute("data-field") === "template-id") {
      this.selectedTemplateId = Number((t as HTMLInputElement).value) || DEFAULT_RECRUIT_TEMPLATE_ID;
    }
    if (t.getAttribute("data-field") === "recruit-item") {
      this.recruitItemId = Number((t as HTMLInputElement).value) || 0;
    }
  }

  private onMailChange(ev: Event): void {
    const t = ev.target as HTMLElement;
    if (t.getAttribute("data-field") === "mail-id") {
      this.selectedMailId = Number((t as HTMLInputElement).value) || 0;
    }
  }

  private onHeroClick(ev: Event): void {
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
