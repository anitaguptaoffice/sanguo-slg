import type { ResourceWallet } from "@/net/bootstrapSession";
import { bagFromListPlayerBagResponse, mergeRewardBundle, mergeWallet, type BagStack } from "@/net/bagState";
import { formatWalletPrice, itemLabel } from "@/net/contentFormat";

/** 与 internal/hero/seed/heroes.json 核心子集展示名对齐（占位，非 legacy 文案）。 */
const HERO_TEMPLATE_LABEL: Record<number, string> = {
  1001: "刘备",
  1002: "关羽",
  1003: "张飞",
  1004: "诸葛亮",
};

export const HERO_RECRUIT_SCROLL_ID = 2004;
export const DEFAULT_RECRUIT_TEMPLATE_ID = 1001;

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

export type HeroDetail = HeroSummary & {
  template_name?: string;
  template_code?: string;
  rarity?: number;
  loyalty_min?: number;
  loyalty_max?: number;
  attributes?: { force?: number; intel?: number; politics?: number; command?: number };
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
};

export type MailRow = {
  mail_id?: number;
  mail_type?: number;
  title?: string;
  body?: string;
  status?: number;
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
    attributes,
  };
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

export function formatRecruitTemplateLine(t: RecruitTemplatePreview): string {
  const name = t.template_name?.trim() || heroTemplateLabel(t.template_cfg_id);
  const cost = formatWalletPrice(t.recruit_cost ?? {});
  const item = t.recruit_item;
  const itemPart = item?.item_cfg_id
    ? `${itemLabel(item.item_cfg_id)}×${item.quantity ?? 1}`
    : "无道具消耗";
  const owned = t.already_owned ? " · 已拥有" : "";
  return `#${t.template_cfg_id ?? "?"} ${name} · 稀有${t.rarity ?? "?"} · ${cost || "无资源"} + ${itemPart}${owned}`;
}

export function recruitTemplateListLines(templates: RecruitTemplatePreview[]): string[] {
  if (!templates.length) return ["（无可招募模板）"];
  return templates.map(formatRecruitTemplateLine);
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

export function mailListLines(mails: MailRow[]): string[] {
  if (!mails.length) return ["（空）"];
  return mails.map(formatMailLine);
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
  const mailPatch = res.mail ?? { mail_id: mailId, status: 2, claimed_at_ms: Date.now() };
  return {
    bag,
    wallet,
    mails: upsertMailRow(mails, mailPatch),
  };
}
