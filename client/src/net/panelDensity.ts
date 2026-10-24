import type { BagStack } from "@/net/bagState";
import { itemLabel } from "@/net/contentFormat";
import { formatMailAttachmentTypeSweep } from "@/net/mailInboxTabFormat";
import {
  mailHasUnclaimedAttachments,
  mailIsUnread,
  mailStatusLabel,
  mailTitle,
  type MailRow,
} from "@/net/heroMailState";
import { formatTimeMs } from "@/net/militaryFormat";

/** 邮件列表未读行 class（与 index.html / CLIENT-027 角标色 #c9a227 一致）。 */
export const MAIL_LIST_ROW_UNREAD_CLASS = "unread";

export const MAIL_LIST_ROW_UNCLAIMED_CLASS = "mail-has-unclaimed";

export const MAIL_UNCLAIMED_BADGE_LABEL = "未领取";

export function mailListRowClassName(m: MailRow): string {
  const classes: string[] = [];
  if (mailIsUnread(m)) classes.push(MAIL_LIST_ROW_UNREAD_CLASS);
  if (mailHasUnclaimedAttachments(m)) classes.push(MAIL_LIST_ROW_UNCLAIMED_CLASS);
  return classes.join(" ");
}

/** 收件箱相对时间（列表次行；与社交刷新戳记同粒度）。 */
export function formatMailRelativeTime(ms: number | undefined, nowMs = Date.now()): string {
  if (!ms || !Number.isFinite(ms)) return "—";
  const delta = Math.max(0, nowMs - ms);
  if (delta < 60_000) return "刚刚";
  const min = Math.floor(delta / 60_000);
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} 小时前`;
  return formatTimeMs(ms);
}

/** 次行附件图标摘要（委托 CLIENT-177 `formatMailAttachmentTypeSweep`）。 */
export function mailRowAttachmentIconSummary(m: MailRow): string {
  return formatMailAttachmentTypeSweep(m);
}

/** 列表主行：主题（未读点在 DOM 侧挂载）。 */
export function mailRowTitleLine(m: MailRow): string {
  return mailTitle(m);
}

/** 列表次行：附件图标摘要 + 相对时间。 */
export function mailRowMetaLine(m: MailRow, nowMs = Date.now()): string {
  const time = formatMailRelativeTime(m.created_at_ms, nowMs);
  const attach = mailRowAttachmentIconSummary(m);
  if (attach && time !== "—") return `${attach} · ${time}`;
  if (attach) return attach;
  if (time !== "—") return `${time} · ${mailStatusLabel(m.status)}`;
  return mailStatusLabel(m.status);
}

export function mailInboxEmptyListClass(): string {
  return "mail-empty";
}

export function mailInboxLoadErrorListHint(): string {
  return "请点「刷新」重试";
}

export function bagEmptyListMessage(): string {
  return "背包为空，可打开底栏「商城」购买或完成「日常」领奖获取道具";
}

export function bagEmptyListClass(): string {
  return "bag-empty";
}

export function shopEmptyListMessage(): string {
  return "货架暂无商品，可点「刷新货架」重试";
}

export function shopListLoadErrorListHint(): string {
  return "请点「刷新货架」重试";
}

const BAG_ITEM_ID_COL_WIDTH = 5;

/** 道具 ID 列（等宽数字，便于与数量列对齐）。 */
export function formatBagListItemIdCell(itemCfgId: number): string {
  const id = String(itemCfgId);
  return id.length >= BAG_ITEM_ID_COL_WIDTH ? id : id.padStart(BAG_ITEM_ID_COL_WIDTH, " ");
}

/** 数量列（右对齐填充）。 */
export function formatBagListQuantityCell(quantity: number): string {
  const q = String(quantity);
  return q.length >= 4 ? q : q.padStart(4, " ");
}

export function formatBagStackRowLabel(row: BagStack): { idCell: string; name: string; qtyCell: string } {
  return {
    idCell: formatBagListItemIdCell(row.item_cfg_id),
    name: itemLabel(row.item_cfg_id),
    qtyCell: formatBagListQuantityCell(row.quantity),
  };
}

export const BATTLE_REPORT_FILTER_EMPTY_TEXT = "无匹配战报";

export function battleReportListEmptyMessage(): string {
  return "暂无战报，出征结算后可在此查看";
}

export function battleReportListErrorListHint(): string {
  return "列表加载失败，请点「重试加载列表」";
}

export function battleReportListEmptyClass(): string {
  return "battle-report-empty";
}

export function battleReportListErrorClass(): string {
  return "battle-report-empty is-error";
}

export function battleReportFilterEmptyClass(): string {
  return "battle-report-filter-empty";
}

export function marchListEmptyMessage(): string {
  return "（暂无行军，出征后在此查看进度）";
}

export function marchListEmptyClass(): string {
  return "march-list-empty";
}

export function marchListLoadErrorListHint(): string {
  return "列表加载失败，请稍后再试";
}

/** 多行军时列表容器 class（紧凑行高，空态行不使用）。 */
export function marchListCompactClass(): string {
  return "march-list-compact";
}
