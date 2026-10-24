import {
  mailHasUnclaimedAttachments,
  mailIsUnread,
  mailTitle,
  type MailRow,
} from "@/net/heroMailState";
import { resolveMailBattleReportLink } from "@/net/mailBattleCrossLink";

/** sessionStorage：战报/系统分类 tab（CLIENT-225，仅客户端过滤 ALL 快照）。 */
export const MAIL_BATTLE_CATEGORY_TAB_SESSION_KEY = "mail-battle-category-tab-v1";

/** 邮件战报类 / 系统类顶栏扫读行（与 CLIENT-209 `mail-tab-unread-sweep` 并存）。 */
export const MAIL_BATTLE_CATEGORY_SWEEP_ROLE = "mail-battle-category-sweep";
export const MAIL_BATTLE_CATEGORY_SWEEP_CLASS = "mail-battle-category-sweep-line";

export type MailBattleCategoryTab = "battle" | "system";

export const MAIL_BATTLE_CATEGORY_TABS: { id: MailBattleCategoryTab; label: string }[] = [
  { id: "battle", label: "战报" },
  { id: "system", label: "系统" },
];

export type MailBattleCategorySweepCounts = {
  unreadCount: number;
  unclaimedCount: number;
};

const CATEGORY_TAB_VALUES: readonly MailBattleCategoryTab[] = ["battle", "system"];

export function parseMailBattleCategoryTabSessionValue(
  raw: string | null | undefined,
): MailBattleCategoryTab | null {
  if (raw == null || raw === "") return null;
  if ((CATEGORY_TAB_VALUES as readonly string[]).includes(raw)) {
    return raw as MailBattleCategoryTab;
  }
  return null;
}

export function readMailBattleCategoryTabSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): MailBattleCategoryTab {
  try {
    return (
      parseMailBattleCategoryTabSessionValue(
        storage?.getItem(MAIL_BATTLE_CATEGORY_TAB_SESSION_KEY) ?? null,
      ) ?? "system"
    );
  } catch {
    return "system";
  }
}

export function writeMailBattleCategoryTabSession(
  tab: MailBattleCategoryTab,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.setItem(MAIL_BATTLE_CATEGORY_TAB_SESSION_KEY, tab);
  } catch {
    /* quota / private mode */
  }
}

/** 战报类：正文/标题可解析战报深链；其余为系统类。 */
export function classifyMailBattleCategory(m: MailRow): MailBattleCategoryTab {
  const title = mailTitle(m);
  const body = m.body ?? "";
  const link = resolveMailBattleReportLink(title, body);
  return link.show ? "battle" : "system";
}

export function filterMailRowsByBattleCategory(
  rows: MailRow[],
  tab: MailBattleCategoryTab,
): MailRow[] {
  return rows.filter((m) => classifyMailBattleCategory(m) === tab);
}

export function mailBattleCategorySweepCounts(
  rows: MailRow[],
  category: MailBattleCategoryTab,
): MailBattleCategorySweepCounts {
  const scoped = filterMailRowsByBattleCategory(rows, category);
  let unreadCount = 0;
  let unclaimedCount = 0;
  for (const m of scoped) {
    if (mailIsUnread(m)) unreadCount += 1;
    if (mailHasUnclaimedAttachments(m)) unclaimedCount += 1;
  }
  return {
    unreadCount: Math.max(0, unreadCount),
    unclaimedCount: Math.max(0, unclaimedCount),
  };
}

/** 战报/系统类 tab 顶栏只读未读/附件计数扫读（与 tab 角标同源快照）。 */
export function formatMailBattleCategorySweepLine(
  category: MailBattleCategoryTab,
  counts: MailBattleCategorySweepCounts,
): string | null {
  const label = category === "battle" ? "战报" : "系统";
  const parts: string[] = [];
  if (counts.unreadCount > 0) parts.push(`未读 ${counts.unreadCount}`);
  if (counts.unclaimedCount > 0) parts.push(`未领附件 ${counts.unclaimedCount}`);
  if (!parts.length) return null;
  return `${label} · ${parts.join(" · ")}`;
}
