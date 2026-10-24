import { formatFilterBadgeCount } from "@/engine/artUiFilterSkin";
import {
  MAIL_INBOX_FILTER_ALL,
  MAIL_INBOX_FILTER_UNCLAIMED,
  MAIL_INBOX_FILTER_UNREAD,
  mailHasUnclaimedAttachments,
  mailIsUnread,
  type MailRow,
} from "@/net/heroMailState";

/** sessionStorage：收件箱 ListPlayerMail filter（CLIENT-122；与 CLIENT-106 tab 角标规则并存）。 */
export const MAIL_INBOX_FILTER_SESSION_KEY = "mail-inbox-filter-v1";

const FILTER_VALUES: readonly number[] = [
  MAIL_INBOX_FILTER_ALL,
  MAIL_INBOX_FILTER_UNREAD,
  MAIL_INBOX_FILTER_UNCLAIMED,
];

export type MailInboxFilterChipSpec = {
  filter: number;
  action: "mail-filter-all" | "mail-filter-unread" | "mail-filter-unclaimed";
  label: string;
  selected: boolean;
  /** 筛选 chip 角标文案（1–9 / 9+；0 为空串隐藏） */
  countBadge: string;
};

export function parseMailInboxFilterSessionValue(
  raw: string | null | undefined,
): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if ((FILTER_VALUES as readonly number[]).includes(n)) return n;
  return null;
}

export function readMailInboxFilterSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): number | null {
  try {
    return parseMailInboxFilterSessionValue(
      storage?.getItem(MAIL_INBOX_FILTER_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function writeMailInboxFilterSession(
  filter: number,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  if (!(FILTER_VALUES as readonly number[]).includes(filter)) return;
  try {
    storage?.setItem(MAIL_INBOX_FILTER_SESSION_KEY, String(filter));
  } catch {
    /* quota / private mode */
  }
}

/**
 * 收件箱筛选 chip 视图（全部=未领附件数角标；未读=未读 total 角标）。
 * 角标格式与 CLIENT-121 `formatFilterBadgeCount` / 面板 count 槽一致（非 HUD 底栏 99+）。
 */
export function formatMailFilterChips(input: {
  activeFilter: number;
  unreadForTab: number;
  unclaimedCount: number;
}): MailInboxFilterChipSpec[] {
  const active = input.activeFilter;
  const unread = Math.max(0, input.unreadForTab);
  const unclaimed = Math.max(0, input.unclaimedCount);
  return [
    {
      filter: MAIL_INBOX_FILTER_ALL,
      action: "mail-filter-all",
      label: "全部",
      selected: active === MAIL_INBOX_FILTER_ALL,
      countBadge: formatFilterBadgeCount(unclaimed),
    },
    {
      filter: MAIL_INBOX_FILTER_UNREAD,
      action: "mail-filter-unread",
      label: "未读",
      selected: active === MAIL_INBOX_FILTER_UNREAD,
      countBadge: formatFilterBadgeCount(unread),
    },
    {
      filter: MAIL_INBOX_FILTER_UNCLAIMED,
      action: "mail-filter-unclaimed",
      label: "未领附件",
      selected: active === MAIL_INBOX_FILTER_UNCLAIMED,
      countBadge: formatFilterBadgeCount(unclaimed),
    },
  ];
}

/** 列表行未读圆点（badge.dot）。 */
export function mailRowShowsUnreadDot(m: MailRow): boolean {
  return mailIsUnread(m);
}

/** 列表行未领附件条数（用于 badge.count；无未领时 0）。 */
export function mailRowAttachmentBadgeCount(m: MailRow): number {
  if (!mailHasUnclaimedAttachments(m)) return 0;
  let n = 0;
  for (const it of m.attachments?.items ?? []) {
    const id = it.item_cfg_id ?? 0;
    if (id <= 0) continue;
    n += Math.max(1, it.quantity ?? 1);
  }
  const resources = m.attachments?.resources;
  if (resources && Object.values(resources).some((v) => (v ?? 0) > 0)) n += 1;
  return n > 0 ? n : 1;
}

/** 列表行 count 角标文案（1–9 / 9+；0 隐藏）。 */
export function formatMailRowCountBadge(m: MailRow): string {
  return formatFilterBadgeCount(mailRowAttachmentBadgeCount(m));
}
