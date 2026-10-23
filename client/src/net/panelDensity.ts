import type { BagStack } from "@/net/bagState";
import { itemLabel } from "@/net/contentFormat";
import {
  mailHasAttachments,
  mailHasUnclaimedAttachments,
  mailIsUnread,
  mailStatusLabel,
  mailTitle,
  MAIL_INBOX_FILTER_UNREAD,
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

/** 列表第一行：标题 + 时间。 */
export function mailRowTitleLine(m: MailRow): string {
  return `${mailTitle(m)} · ${formatTimeMs(m.created_at_ms)}`;
}

/** 列表第二行：附件 / 已读角标文案。 */
export function mailRowMetaLine(m: MailRow): string {
  if (mailHasUnclaimedAttachments(m)) return "附件待领";
  if (mailHasAttachments(m)) return "附件已领";
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

/** 多行军时列表容器 class（紧凑行高，空态行不使用）。 */
export function marchListCompactClass(): string {
  return "march-list-compact";
}
