import type { ResourceWallet } from "@/net/bootstrapSession";
import { formatMailTabEmptyHint, mailInboxFilterToEmptyTab } from "@/net/mailInboxTabFormat";
import { bagFromListPlayerBagResponse, mergeRewardBundle, mergeWallet, type BagStack } from "@/net/bagState";
import { formatWalletPrice, itemLabel } from "@/net/contentFormat";
import {
  formatHeroUpgradeItemGap,
  evaluateHeroUpgradeItemGap,
  resolveHeroLevelUpgradeItemNeed,
  resolveHeroLoyaltyUpgradeItemNeed,
} from "@/net/heroUpgradeItemGap";

/** 与 internal/hero/seed/heroes.json 核心子集展示名对齐（占位，非 legacy 文案）。 */
const HERO_TEMPLATE_LABEL: Record<number, string> = {
  1001: "刘备",
  1002: "关羽",
  1003: "张飞",
  1004: "诸葛亮",
};

export const HERO_RECRUIT_SCROLL_ID = 2004;
export const DEFAULT_RECRUIT_TEMPLATE_ID = 1001;

/** 与 content.v1.PlayerMail.status / MailInboxFilter 对齐 */
export const MAIL_STATUS_UNREAD = 0;
export const MAIL_STATUS_READ = 1;
export const MAIL_STATUS_CLAIMED = 2;

export const MAIL_INBOX_FILTER_ALL = 0;
export const MAIL_INBOX_FILTER_UNREAD = 1;
/** 客户端 tab：ListPlayerMail 仍用 ALL，列表在本地筛未领附件（CLIENT-177）。 */
export const MAIL_INBOX_FILTER_UNCLAIMED = 3;

const MAIL_STATUS_LABEL: Record<number, string> = {
  0: "未读",
  1: "已读",
  2: "已领取",
  3: "已删",
};

export type HeroSummary = {
  hero_id?: number;
  template_cfg_id?: number;
  level?: number;
  loyalty?: number;
};

export type HeroAttributes = {
  force?: number;
  intel?: number;
  politics?: number;
  command?: number;
};

export type HeroAttributeKey = keyof HeroAttributes;

/** 与 hero.v1.HeroAttributes 字段一一对应（验收口径：攻/防/统等展示为武/智/政/统）。 */
export const HERO_ATTRIBUTE_ROWS: { key: HeroAttributeKey; label: string }[] = [
  { key: "force", label: "武力" },
  { key: "intel", label: "智力" },
  { key: "politics", label: "政治" },
  { key: "command", label: "统率" },
];

export const HERO_ATTR_BAR_CAP = 100;

export type HeroDetail = HeroSummary & {
  template_name?: string;
  template_code?: string;
  rarity?: number;
  loyalty_min?: number;
  loyalty_max?: number;
  attributes?: HeroAttributes;
  /** 网关可选：本级经验进度（无字段时详情区降级为 Lv+忠诚摘要）。 */
  exp_current?: number;
  exp_to_next?: number;
  /** 网关可选：升级所需道具（无字段时客户端按养成子集推导）。 */
  level_upgrade_item?: { item_cfg_id?: number; quantity?: number };
  /** 网关可选：忠诚养成所需道具。 */
  loyalty_upgrade_item?: { item_cfg_id?: number; quantity?: number };
};

export type RecruitTemplatePreview = {
  template_cfg_id?: number;
  template_name?: string;
  template_code?: string;
  pool?: string;
  rarity?: number;
  recruit_cost?: ResourceWallet;
  recruit_item?: { item_cfg_id?: number; quantity?: number };
  already_owned?: boolean;
  /** 可选：模板基准四维（缺省时用核心 template_cfg_id 子集表）。 */
  base_attributes?: HeroAttributes;
};

/** 与 internal/hero/seed 核心子集 base_stats 数值对齐（只读对比，非 legacy 文案）。 */
const HERO_TEMPLATE_BASE_STATS: Record<number, HeroAttributes> = {
  1001: { force: 72, intel: 75, politics: 88, command: 78 },
  1002: { force: 95, intel: 62, politics: 55, command: 82 },
  1003: { force: 92, intel: 45, politics: 40, command: 75 },
  1004: { force: 88, intel: 70, politics: 58, command: 85 },
};

/** DATA-001 养成消耗品子集（如 hero_exp），不扩 SKU。 */
export const HERO_CULTIVATION_CONSUMABLE_CFG_IDS: readonly number[] = [2017];

export type HeroAttributeDeltaRow = {
  key: HeroAttributeKey;
  label: string;
  current: number;
  baseline: number;
  delta: number;
};

export type HeroDetailTemplateCompare = {
  rows: HeroAttributeDeltaRow[];
  hasBaseline: boolean;
};

export type HeroUpgradeProgressBar = {
  kind: "level_exp" | "loyalty";
  label: string;
  current: number;
  max: number;
  percent: number;
  caption: string;
};

export type HeroDetailUpgradeProgress =
  | { mode: "bars"; bars: HeroUpgradeProgressBar[] }
  | { mode: "fallback"; summary: string };

export type MailRow = {
  mail_id?: number;
  mail_type?: number;
  title?: string;
  body?: string;
  status?: number;
  /** 网关可选字段；缺省时由 status + attachments 推导。 */
  has_unclaimed_attachments?: boolean;
  attachments?: {
    items?: { item_cfg_id?: number; quantity?: number }[];
    resources?: ResourceWallet;
  };
  created_at_ms?: number;
  read_at_ms?: number;
  claimed_at_ms?: number;
};

export function heroTemplateLabel(templateCfgId: number | undefined): string {
  if (!templateCfgId) return "?";
  return HERO_TEMPLATE_LABEL[templateCfgId] ?? `将领#${templateCfgId}`;
}

export function mailStatusLabel(status: number | undefined): string {
  return MAIL_STATUS_LABEL[status ?? 0] ?? `状态${status}`;
}

export function formatHeroLine(h: HeroSummary): string {
  const name = heroTemplateLabel(h.template_cfg_id);
  return `#${h.hero_id ?? "?"} ${name} · Lv${h.level ?? 1} · 忠诚 ${h.loyalty ?? 0}`;
}

/** GetHeroDetail / UseConsumable 后把列表行 level/loyalty 与详情区进度条对齐。 */
export function syncHeroSummaryFromDetail(
  heroes: HeroSummary[],
  detail: HeroDetail | null | undefined,
): HeroSummary[] {
  const heroId = detail?.hero_id;
  if (!heroId) return heroes;
  return heroes.map((h) =>
    h.hero_id === heroId
      ? { ...h, level: detail.level ?? h.level, loyalty: detail.loyalty ?? h.loyalty }
      : h,
  );
}

/** 将领养成道具走背包 UseConsumable，详情区展示用（无 hero 专用 RPC）。 */
export const HERO_DETAIL_TRAINING_HINT =
  "养成：打开底栏「背包」→「使用道具」调用 content.v1.UseConsumable（忠诚度等效果以服务端为准）。";

export class InvalidHeroDetailRequestError extends Error {
  constructor(message = "hero_id 无效") {
    super(message);
    this.name = "InvalidHeroDetailRequestError";
  }
}

/** 客户端校验：空 hero_id 不发 GetHeroDetail。 */
export function requireHeroIdForDetail(heroId: number): void {
  if (!Number.isFinite(heroId) || heroId <= 0) {
    throw new InvalidHeroDetailRequestError("请先选择将领（hero_id 不能为空）");
  }
}

/** 将网关 GetHeroDetailResponse 解码结果规范为 HeroDetail。 */
export function parseGetHeroDetailResponse(raw: unknown): HeroDetail {
  const r = (raw ?? {}) as Record<string, unknown>;
  const attrsRaw = r.attributes as Record<string, unknown> | null | undefined;
  const attributes =
    attrsRaw && typeof attrsRaw === "object"
      ? {
          force: numField(attrsRaw.force),
          intel: numField(attrsRaw.intel),
          politics: numField(attrsRaw.politics),
          command: numField(attrsRaw.command),
        }
      : undefined;
  return {
    hero_id: numField(r.hero_id),
    template_cfg_id: numField(r.template_cfg_id),
    template_name: strField(r.template_name),
    template_code: strField(r.template_code),
    rarity: numField(r.rarity),
    level: numField(r.level),
    loyalty: numField(r.loyalty),
    loyalty_min: numField(r.loyalty_min),
    loyalty_max: numField(r.loyalty_max),
    exp_current: numField(r.exp_current ?? r.level_exp_current ?? r.experience),
    exp_to_next: numField(r.exp_to_next ?? r.exp_to_next_level ?? r.level_exp_max ?? r.exp_max),
    level_upgrade_item: parseItemNeedField(r.level_upgrade_item ?? r.level_up_item),
    loyalty_upgrade_item: parseItemNeedField(r.loyalty_upgrade_item ?? r.loyalty_up_item),
    attributes,
  };
}

function parseItemNeedField(raw: unknown): { item_cfg_id?: number; quantity?: number } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const item_cfg_id = numField(o.item_cfg_id ?? o.itemCfgId);
  const quantity = numField(o.quantity ?? o.qty);
  if (item_cfg_id == null && quantity == null) return undefined;
  return { item_cfg_id, quantity };
}

export function heroTemplateBaseStats(templateCfgId: number | undefined): HeroAttributes | undefined {
  if (!templateCfgId) return undefined;
  return HERO_TEMPLATE_BASE_STATS[templateCfgId];
}

/** 纯函数：当前将领四维 vs 模板基准（±N），不发 hero RPC。 */
export function compareHeroDetailToTemplate(
  detail: HeroDetail | null | undefined,
  templatePreview: RecruitTemplatePreview | null | undefined,
): HeroDetailTemplateCompare {
  const templateId = templatePreview?.template_cfg_id ?? detail?.template_cfg_id;
  const baseline =
    templatePreview?.base_attributes ?? heroTemplateBaseStats(templateId) ?? ({} as HeroAttributes);
  const hasBaseline = HERO_ATTRIBUTE_ROWS.some(({ key }) => baseline[key] != null);
  const attrs = detail?.attributes ?? {};
  const rows = HERO_ATTRIBUTE_ROWS.map(({ key, label }) => {
    const current = attrs[key] ?? 0;
    const base = baseline[key] ?? 0;
    return { key, label, current, baseline: base, delta: current - base };
  });
  return { rows, hasBaseline };
}

export function formatHeroAttributeDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return String(delta);
  return "0";
}

export function resolveHeroDetailUpgradeProgress(detail: HeroDetail): HeroDetailUpgradeProgress {
  const bars: HeroUpgradeProgressBar[] = [];
  const expCur = detail.exp_current;
  const expMax = detail.exp_to_next;
  if (expCur != null && expMax != null && expMax > 0) {
    bars.push({
      kind: "level_exp",
      label: "等级经验",
      current: expCur,
      max: expMax,
      percent: Math.min(100, Math.max(0, Math.round((expCur / expMax) * 100))),
      caption: `Lv${detail.level ?? 1} · ${expCur}/${expMax}`,
    });
  }
  const loyalty = detail.loyalty ?? 0;
  const lmin = detail.loyalty_min;
  const lmax = detail.loyalty_max;
  if (lmin != null && lmax != null && lmax > lmin) {
    bars.push({
      kind: "loyalty",
      label: "忠诚",
      current: loyalty,
      max: lmax,
      percent: Math.min(100, Math.max(0, Math.round(((loyalty - lmin) / (lmax - lmin)) * 100))),
      caption: `${loyalty}/${lmax}`,
    });
  }
  if (!bars.length) {
    return { mode: "fallback", summary: `Lv${detail.level ?? 1} · 忠诚 ${loyalty}` };
  }
  return { mode: "bars", bars };
}

/** ListPlayerBag 快照中筛出养成相关消耗品 item_cfg_id（qty>0）。 */
export function filterHeroCultivationBagItemIds(
  items: { item_cfg_id?: number; quantity?: number }[] | BagStack[],
): number[] {
  const allow = new Set(HERO_CULTIVATION_CONSUMABLE_CFG_IDS);
  const ids: number[] = [];
  for (const row of items) {
    const id = row.item_cfg_id ?? 0;
    const qty = row.quantity ?? 0;
    if (id > 0 && allow.has(id) && qty > 0) ids.push(id);
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

function numField(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function strField(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

export function formatHeroDetail(d: HeroDetail): string {
  const name = d.template_name || heroTemplateLabel(d.template_cfg_id);
  const attrs = d.attributes;
  const attrLine = attrs
    ? `武${attrs.force ?? 0} 智${attrs.intel ?? 0} 政${attrs.politics ?? 0} 统${attrs.command ?? 0}`
    : "—";
  const loyaltyRange =
    d.loyalty_min != null
      ? `（区间 ${d.loyalty_min}~${d.loyalty_max ?? d.loyalty ?? 0}）`
      : "";
  return (
    `${name}（${d.template_code ?? d.template_cfg_id}）\n` +
    `稀有度 ${d.rarity ?? "?"} · Lv${d.level ?? 1} · 忠诚 ${d.loyalty ?? 0}${loyaltyRange}\n` +
    `属性：${attrLine}\n` +
    HERO_DETAIL_TRAINING_HINT
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHeroUpgradeItemGapLine(
  kind: "level_exp" | "loyalty",
  need: { itemCfgId: number; quantity: number } | null,
  bag: BagStack[],
): string {
  if (!need) return "";
  const text = formatHeroUpgradeItemGap(need, bag);
  if (!text) return "";
  const gap = evaluateHeroUpgradeItemGap(need, bag);
  const warn = gap.sufficient ? "" : " hero-upgrade-item-gap-warn";
  return `<p class="hero-upgrade-item-gap${warn}" data-role="hero-upgrade-item-gap" data-kind="${kind}">${escapeHtml(text)}</p>`;
}

function renderHeroUpgradeProgressMarkup(d: HeroDetail, bag: BagStack[] = []): string {
  const progress = resolveHeroDetailUpgradeProgress(d);
  const levelNeed = resolveHeroLevelUpgradeItemNeed(d);
  const loyaltyNeed = resolveHeroLoyaltyUpgradeItemNeed(d);
  if (progress.mode === "fallback") {
    const levelGap = levelNeed ? renderHeroUpgradeItemGapLine("level_exp", levelNeed, bag) : "";
    const loyaltyGap = loyaltyNeed ? renderHeroUpgradeItemGapLine("loyalty", loyaltyNeed, bag) : "";
    return `<p class="hero-upgrade-fallback">${escapeHtml(progress.summary)}</p>${levelGap}${loyaltyGap}`;
  }
  const bars = progress.bars
    .map((b) => {
      const need =
        b.kind === "level_exp"
          ? levelNeed
          : b.kind === "loyalty"
            ? loyaltyNeed
            : null;
      const gapLine = need != null ? renderHeroUpgradeItemGapLine(b.kind, need, bag) : "";
      return (
        `<div class="hero-progress-row" data-kind="${b.kind}"><span class="hero-progress-label">${escapeHtml(b.label)}</span>` +
        `<span class="hero-progress-caption">${escapeHtml(b.caption)}</span>` +
        `<span class="hero-progress-track" role="progressbar" aria-valuenow="${b.percent}" aria-valuemin="0" aria-valuemax="100">` +
        `<span class="hero-progress-fill" style="width:${b.percent}%"></span></span>${gapLine}</div>`
      );
    })
    .join("");
  return `<section class="hero-upgrade-progress" aria-label="养成进度">${bars}</section>`;
}

/** 将领详情区：模板名与等级同屏 + 属性表/条形（纯函数，便于单测）。 */
export function renderHeroDetailMarkup(
  d: HeroDetail | null | undefined,
  recruitAffordSummaryHtml = "",
  templatePreview?: RecruitTemplatePreview | null,
  cultivationUseHtml = "",
  bag: BagStack[] = [],
): string {
  if (!d?.hero_id) {
    return '<p class="hero-detail-empty">点选将领查看详情</p>';
  }
  const name = escapeHtml(d.template_name || heroTemplateLabel(d.template_cfg_id));
  const level = d.level ?? 1;
  const rarity = d.rarity ?? "?";
  const loyalty = d.loyalty ?? 0;
  const loyaltyRange =
    d.loyalty_min != null
      ? ` · 忠诚 ${loyalty}（${d.loyalty_min}~${d.loyalty_max ?? loyalty}）`
      : ` · 忠诚 ${loyalty}`;
  const head = `<header class="hero-detail-head"><span class="hero-detail-name">${name}</span><span class="hero-detail-level">Lv${level}</span><span class="hero-detail-meta">稀有${rarity}${loyaltyRange}</span></header>`;
  const progress = renderHeroUpgradeProgressMarkup(d, bag);
  const comparison = compareHeroDetailToTemplate(d, templatePreview ?? null);
  const deltaByKey = new Map(comparison.rows.map((r) => [r.key, r]));
  const attrs = d.attributes;
  const rows = HERO_ATTRIBUTE_ROWS.map(({ key, label }) => {
    const val = attrs?.[key] ?? 0;
    const pct = heroAttributeBarPercent(val);
    const deltaRow = deltaByKey.get(key);
    const deltaClass =
      deltaRow && deltaRow.delta > 0
        ? "hero-attr-delta-pos"
        : deltaRow && deltaRow.delta < 0
          ? "hero-attr-delta-neg"
          : "hero-attr-delta-zero";
    const deltaCell =
      comparison.hasBaseline && deltaRow
        ? `<td class="hero-attr-delta ${deltaClass}">${formatHeroAttributeDelta(deltaRow.delta)}</td>`
        : "";
    return `<tr><th scope="row">${escapeHtml(label)}</th><td class="hero-attr-val">${val}</td>${deltaCell}<td class="hero-attr-bar"><span class="hero-attr-bar-fill" style="width:${pct}%"></span></td></tr>`;
  }).join("");
  const table = `<table class="hero-attr-table" aria-label="基础属性"><tbody>${rows}</tbody></table>`;
  const links = `<div class="hero-detail-links">
    <button type="button" data-action="hero-goto-recruit">去招募</button>
    <button type="button" data-action="hero-related-items">相关道具</button>
  </div>`;
  const hint = `<p class="hero-detail-hint">${escapeHtml(HERO_DETAIL_TRAINING_HINT)}</p>`;
  return `${head}${progress}${recruitAffordSummaryHtml}${table}${links}${cultivationUseHtml}${hint}`;
}

export function formatMailLine(m: MailRow): string {
  const att = m.attachments;
  let attachHint = "";
  if (att?.items?.length) {
    attachHint =
      " · 附件 " +
      att.items.map((i) => `${itemLabel(i.item_cfg_id)}×${i.quantity ?? 0}`).join(", ");
  } else if (att?.resources) {
    attachHint = ` · 附件 ${formatWalletPrice(att.resources)}`;
  }
  const title = m.title?.trim() || `邮件#${m.mail_id ?? "?"}`;
  return `#${m.mail_id ?? "?"} ${title} · ${mailStatusLabel(m.status)}${attachHint}`;
}

export function heroListLines(heroes: HeroSummary[]): string[] {
  if (!heroes.length) return ["（尚无将领，可尝试招募）"];
  return heroes.map(formatHeroLine);
}

/** 规范化 ListRecruitTemplates 响应（过滤无 id 行）。 */
export function parseRecruitTemplates(res: {
  templates?: RecruitTemplatePreview[];
  total_count?: number;
}): { templates: RecruitTemplatePreview[]; totalCount: number } {
  const templates = (res.templates ?? []).filter((t) => (t.template_cfg_id ?? 0) > 0);
  const totalCount = res.total_count ?? templates.length;
  return { templates, totalCount };
}

export function heroOwnedTemplateIds(heroes: HeroSummary[]): Set<number> {
  const ids = new Set<number>();
  for (const h of heroes) {
    const id = h.template_cfg_id;
    if (id != null && id > 0) ids.add(id);
  }
  return ids;
}

/** 已招募：API already_owned 或玩家将领列表含同 template_cfg_id。 */
export function isRecruitTemplateOwned(
  template: RecruitTemplatePreview,
  ownedTemplateIds: ReadonlySet<number>,
): boolean {
  if (template.already_owned) return true;
  const id = template.template_cfg_id;
  return id != null && id > 0 && ownedTemplateIds.has(id);
}

export function mergeRecruitTemplateOwnership(
  templates: RecruitTemplatePreview[],
  heroes: HeroSummary[],
): RecruitTemplatePreview[] {
  const owned = heroOwnedTemplateIds(heroes);
  return templates.map((t) => ({
    ...t,
    already_owned: isRecruitTemplateOwned(t, owned),
  }));
}

export function heroAttributeBarPercent(value: number | undefined, cap = HERO_ATTR_BAR_CAP): number {
  const v = value ?? 0;
  if (!Number.isFinite(cap) || cap <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((v / cap) * 100)));
}

export function formatRecruitTemplateLine(t: RecruitTemplatePreview): string {
  const name = t.template_name?.trim() || heroTemplateLabel(t.template_cfg_id);
  const cost = formatWalletPrice(t.recruit_cost ?? {});
  const item = t.recruit_item;
  const itemPart = item?.item_cfg_id
    ? `${itemLabel(item.item_cfg_id)}×${item.quantity ?? 1}`
    : "无道具消耗";
  const owned = t.already_owned ? " · 已招募" : "";
  return `#${t.template_cfg_id ?? "?"} ${name} · 稀有${t.rarity ?? "?"} · ${cost || "无资源"} + ${itemPart}${owned}`;
}

export function recruitTemplateListLines(templates: RecruitTemplatePreview[]): string[] {
  if (!templates.length) return ["（无可招募模板）"];
  return templates.map(formatRecruitTemplateLine);
}

export type RecruitHeroResult = {
  hero_id?: number;
  template_cfg_id?: number;
  level?: number;
  loyalty?: number;
};

export function formatRecruitDeductSummary(template: RecruitTemplatePreview | undefined): string {
  if (!template) return "无消耗记录";
  const cost = formatWalletPrice(template.recruit_cost ?? {});
  const item = template.recruit_item;
  const itemPart = item?.item_cfg_id
    ? `${itemLabel(item.item_cfg_id)}×${item.quantity ?? 1}`
    : "";
  const parts = [cost, itemPart].filter(Boolean);
  return parts.length ? parts.join(" + ") : "无资源/道具消耗";
}

export function formatRecruitSuccessStatus(
  res: RecruitHeroResult,
  template: RecruitTemplatePreview | undefined,
): string {
  const tplId = res.template_cfg_id ?? template?.template_cfg_id;
  const name = template?.template_name?.trim() || heroTemplateLabel(tplId);
  const deduct = formatRecruitDeductSummary(template);
  return `招募成功：${name} #${res.hero_id ?? "?"} Lv${res.level ?? 1} · 已扣 ${deduct}`;
}

export function pickRecruitSelection(
  templates: RecruitTemplatePreview[],
  preferredTemplateId?: number,
): { templateCfgId: number; itemCfgId: number; pool: string } | null {
  if (!templates.length) return null;
  const row =
    templates.find((t) => t.template_cfg_id === preferredTemplateId) ?? templates[0];
  return {
    templateCfgId: row.template_cfg_id ?? DEFAULT_RECRUIT_TEMPLATE_ID,
    itemCfgId: row.recruit_item?.item_cfg_id ?? HERO_RECRUIT_SCROLL_ID,
    pool: row.pool?.trim() || "standard",
  };
}

export function mailIsUnread(m: MailRow): boolean {
  return (m.status ?? MAIL_STATUS_UNREAD) === MAIL_STATUS_UNREAD;
}

/** 与 MAIL_INBOX_FILTER_UNREAD / read_at_ms 等价：已标读时间戳优先于 status 占位。 */
export function mailIsUnreadForInboxCount(m: MailRow): boolean {
  if ((m.read_at_ms ?? 0) > 0) return false;
  return mailIsUnread(m);
}

export type MailInboxBadgeCounts = { unread: number; unclaimed: number };

/** ListPlayerMail（filter=all）快照上推导面板 tab 未读 / 未领附件条数。 */
export function countMailUnreadAndUnclaimed(mails: MailRow[]): MailInboxBadgeCounts {
  let unread = 0;
  let unclaimed = 0;
  for (const m of mails) {
    if (mailIsUnreadForInboxCount(m)) unread++;
    if (mailHasUnclaimedAttachments(m)) unclaimed++;
  }
  return { unread, unclaimed };
}

export function formatMailInboxUnreadTabLabel(unreadCount: number): string {
  const n = Math.max(0, unreadCount);
  return n > 0 ? `未读 ${n}` : "未读";
}

/** 「全部」tab 角标：仅在有未领附件时展示 `附件 M`。 */
export function formatMailInboxAllTabAttachmentBadge(unclaimedCount: number): string {
  const n = Math.max(0, unclaimedCount);
  return n > 0 ? `附件 ${n}` : "";
}

export function mailHasAttachments(m: MailRow): boolean {
  const att = m.attachments;
  if (!att) return false;
  if (att.items?.length) return true;
  const r = att.resources;
  return !!(r && Object.values(r).some((v) => (v ?? 0) > 0));
}

/** 仍有未领取附件（API 字段或 status+attachments 等价推导）。 */
export function mailHasUnclaimedAttachments(m: MailRow): boolean {
  if (typeof m.has_unclaimed_attachments === "boolean") return m.has_unclaimed_attachments;
  return mailHasAttachments(m) && (m.status ?? MAIL_STATUS_UNREAD) !== MAIL_STATUS_CLAIMED;
}

/** @deprecated 语义同 mailHasUnclaimedAttachments，保留旧调用点。 */
export function mailCanClaimAttachments(m: MailRow): boolean {
  return mailHasUnclaimedAttachments(m);
}

export function countMailsWithUnclaimedAttachments(mails: MailRow[]): number {
  return mails.filter(mailHasUnclaimedAttachments).length;
}

/** 领取成功状态栏：道具 id/名 + 数量，资源走钱包文案。 */
export function formatMailClaimGrantedSummary(granted?: {
  items?: { item_cfg_id?: number; quantity?: number }[];
  resources?: ResourceWallet;
}): string {
  const parts: string[] = [];
  for (const it of granted?.items ?? []) {
    const id = it.item_cfg_id;
    if (id == null || id <= 0) continue;
    parts.push(`${itemLabel(id)}×${it.quantity ?? 0}`);
  }
  const resText = formatWalletPrice(granted?.resources ?? {});
  if (resText) parts.push(resText);
  return parts.length ? parts.join("、") : "无附件明细";
}

export function mailTitle(m: MailRow): string {
  return m.title?.trim() || `邮件#${m.mail_id ?? "?"}`;
}

/** 列表摘要：正文首行截断，无正文时展示附件/状态提示。 */
export function mailListSummary(m: MailRow, maxLen = 48): string {
  const body = m.body?.replace(/\s+/g, " ").trim();
  if (body) {
    return body.length <= maxLen ? body : `${body.slice(0, maxLen)}…`;
  }
  if (mailHasAttachments(m)) {
    if (mailCanClaimAttachments(m)) return "含附件，可一键领取";
    return "附件已领取";
  }
  return mailStatusLabel(m.status);
}

export function mailEmptyInboxMessage(filter: number): string {
  return formatMailTabEmptyHint(mailInboxFilterToEmptyTab(filter));
}

export function mailListLines(mails: MailRow[]): string[] {
  if (!mails.length) return [mailEmptyInboxMessage(MAIL_INBOX_FILTER_ALL)];
  return mails.map(formatMailLine);
}

export function countUnreadInMails(mails: MailRow[]): number {
  return mails.filter(mailIsUnread).length;
}

export function upsertMailRow(mails: MailRow[], updated: MailRow): MailRow[] {
  const id = updated.mail_id;
  if (!id) return mails;
  const idx = mails.findIndex((m) => m.mail_id === id);
  if (idx < 0) return [...mails, updated];
  const next = [...mails];
  next[idx] = { ...next[idx], ...updated };
  return next;
}

export type ClaimMailSessionPatch = {
  bag: BagStack[];
  wallet: ResourceWallet;
  mails: MailRow[];
};

/** 领取附件后更新列表行「已领」态（与 tab/HUD `countMailUnreadAndUnclaimed` 快照同源）。 */
export function syncMailRowAfterClaim(
  mails: MailRow[],
  mailId: number,
  res: { mail?: MailRow },
): MailRow[] {
  const mailPatch: MailRow = {
    ...(res.mail ?? { mail_id: mailId, status: MAIL_STATUS_CLAIMED, claimed_at_ms: Date.now() }),
    mail_id: mailId,
    has_unclaimed_attachments: false,
  };
  return upsertMailRow(mails, mailPatch);
}

/** 角标推导快照 `mailInboxSnapshot` 与列表行领取态对齐。 */
export function syncMailInboxSnapshotAfterClaim(
  snapshot: MailRow[],
  mailId: number,
  rowAfter: MailRow,
): MailRow[] {
  return upsertMailRow(snapshot, {
    ...rowAfter,
    mail_id: mailId,
    has_unclaimed_attachments: false,
  });
}

/** 领取附件后合并会话背包/钱包并更新邮件行状态。 */
export function applyMailClaimResult(
  mails: MailRow[],
  mailId: number,
  res: {
    mail?: MailRow;
    granted?: { items?: { item_cfg_id?: number; quantity?: number }[]; resources?: ResourceWallet };
    wallet_after?: ResourceWallet;
    bag_items?: { item_cfg_id?: number; quantity?: number }[];
  },
  session: { bag?: BagStack[]; wallet?: ResourceWallet },
): ClaimMailSessionPatch {
  const bagBase = session.bag ?? [];
  const bagFromServer = bagFromListPlayerBagResponse(res.bag_items);
  const bag =
    bagFromServer.length > 0
      ? bagFromServer
      : mergeRewardBundle(bagBase, res.granted);
  const wallet = res.wallet_after
    ? { ...res.wallet_after }
    : mergeWallet(session.wallet ?? {}, res.granted?.resources);
  return {
    bag,
    wallet,
    mails: syncMailRowAfterClaim(mails, mailId, res),
  };
}
