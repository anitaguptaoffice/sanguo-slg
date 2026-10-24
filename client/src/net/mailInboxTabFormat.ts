import { formatResourceAmount, WALLET_RESOURCE_KEYS } from "@/net/hudFormat";
import { itemLabel } from "@/net/contentFormat";
import {
  MAIL_INBOX_FILTER_ALL,
  MAIL_INBOX_FILTER_UNCLAIMED,
  MAIL_INBOX_FILTER_UNREAD,
  mailHasAttachments,
  mailHasUnclaimedAttachments,
  type MailRow,
} from "@/net/heroMailState";

/** 收件箱空态 tab（全部 / 未读 / 未领附件）。 */
export type MailInboxEmptyTab = "all" | "unread" | "unclaimed";

const DEV_MAIL_SEED_HINT =
  "dev 环境可能未写入邮件种子，可 GM 发信或对照 smoke / Scheduler 造数。";

const RESOURCE_ATTACH_ICON: Partial<Record<string, string>> = {
  food: "🌾",
  wood: "🪵",
  iron: "⚙",
  stone: "🪨",
  gold: "💰",
};

export function mailInboxFilterToEmptyTab(filter: number): MailInboxEmptyTab {
  if (filter === MAIL_INBOX_FILTER_UNREAD) return "unread";
  if (filter === MAIL_INBOX_FILTER_UNCLAIMED) return "unclaimed";
  return "all";
}

/** 分 tab 空列表 hint（CLIENT-129 `data-panel-state=empty` 文案源）。 */
export function formatMailTabEmptyHint(tab: MailInboxEmptyTab): string {
  switch (tab) {
    case "unread":
      return `（无未读）暂无未读邮件；已读与待领附件请在「全部」或「未领附件」查看。${DEV_MAIL_SEED_HINT}`;
    case "unclaimed":
      return `（未领附件）当前 tab 无待领附件邮件；可切「全部」查看历史或点「刷新」同步。${DEV_MAIL_SEED_HINT}`;
    case "all":
    default:
      return `（空收件箱）暂无邮件，完成「日常」领奖或等待系统发放；GM 发信后点「刷新」。${DEV_MAIL_SEED_HINT}`;
  }
}

/** ListPlayerMail filter：未领附件 tab 仍走 ALL 快照后客户端过滤。 */
export function resolveMailListPlayerMailFilter(filter: number): number {
  if (filter === MAIL_INBOX_FILTER_UNCLAIMED) return MAIL_INBOX_FILTER_ALL;
  return filter;
}

export function filterMailRowsForInboxTab(rows: MailRow[], filter: number): MailRow[] {
  if (filter === MAIL_INBOX_FILTER_UNCLAIMED) {
    return rows.filter((m) => mailHasUnclaimedAttachments(m));
  }
  return rows;
}

/**
 * 附件行次行类型图标扫读（只读 attachments metadata；📎 待领 / ✓ 已领）。
 * 与 `mailRowMetaLine` / CLIENT-143 时间戳并存。
 */
export function formatMailAttachmentTypeSweep(m: MailRow): string {
  if (!mailHasAttachments(m)) return "";
  const segments: string[] = [];
  const resources = m.attachments?.resources ?? {};
  for (const { key, label } of WALLET_RESOURCE_KEYS) {
    const amount = resources[key];
    if (!amount || amount <= 0) continue;
    const icon = RESOURCE_ATTACH_ICON[key] ?? "◆";
    segments.push(`${icon}${label}${formatResourceAmount(amount)}`);
  }
  for (const it of m.attachments?.items ?? []) {
    const id = it.item_cfg_id ?? 0;
    if (id <= 0) continue;
    const qty = Math.max(0, it.quantity ?? 0);
    segments.push(`🎁${itemLabel(id)}×${qty}`);
  }
  const body = segments.length ? segments.join(" · ") : "附件";
  if (mailHasUnclaimedAttachments(m)) return `📎 ${body}`;
  return `✓ ${body}`;
}
