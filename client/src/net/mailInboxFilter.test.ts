import { describe, expect, it } from "vitest";
import {
  formatMailFilterChips,
  formatMailRowCountBadge,
  MAIL_INBOX_FILTER_SESSION_KEY,
  mailRowAttachmentBadgeCount,
  mailRowShowsUnreadDot,
  parseMailInboxFilterSessionValue,
  readMailInboxFilterSession,
  writeMailInboxFilterSession,
} from "@/net/mailInboxFilter";
import { MAIL_INBOX_FILTER_ALL, MAIL_INBOX_FILTER_UNREAD } from "@/net/heroMailState";

describe("mailInboxFilter session", () => {
  it("uses mail-inbox-filter-v1 key", () => {
    expect(MAIL_INBOX_FILTER_SESSION_KEY).toBe("mail-inbox-filter-v1");
  });

  it("round-trips filter via sessionStorage", () => {
    const storage = new Map<string, string>();
    const mock = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storage.set(k, v);
      },
    };
    writeMailInboxFilterSession(MAIL_INBOX_FILTER_UNREAD, mock);
    expect(readMailInboxFilterSession(mock)).toBe(MAIL_INBOX_FILTER_UNREAD);
    expect(parseMailInboxFilterSessionValue("2")).toBeNull();
  });
});

describe("formatMailFilterChips", () => {
  it("marks selected chip and formats tab count badges", () => {
    const chips = formatMailFilterChips({
      activeFilter: MAIL_INBOX_FILTER_UNREAD,
      unreadForTab: 12,
      unclaimedCount: 3,
    });
    expect(chips[0].label).toBe("全部");
    expect(chips[0].selected).toBe(false);
    expect(chips[0].countBadge).toBe("3");
    expect(chips[1].label).toBe("未读");
    expect(chips[1].selected).toBe(true);
    expect(chips[1].countBadge).toBe("9+");
  });

  it("hides count badges at zero", () => {
    const chips = formatMailFilterChips({
      activeFilter: MAIL_INBOX_FILTER_ALL,
      unreadForTab: 0,
      unclaimedCount: 0,
    });
    expect(chips[0].countBadge).toBe("");
    expect(chips[1].countBadge).toBe("");
  });
});

describe("mail row badge pure fns", () => {
  it("unread dot follows mailIsUnread", () => {
    expect(mailRowShowsUnreadDot({ mail_id: 1, status: 0 })).toBe(true);
    expect(mailRowShowsUnreadDot({ mail_id: 1, status: 1 })).toBe(false);
  });

  it("attachment count sums item quantities and caps label", () => {
    const mail = {
      mail_id: 2,
      status: 0,
      attachments: {
        items: [
          { item_cfg_id: 2001, quantity: 4 },
          { item_cfg_id: 2002, quantity: 8 },
        ],
      },
    };
    expect(mailRowAttachmentBadgeCount(mail)).toBe(12);
    expect(formatMailRowCountBadge(mail)).toBe("9+");
  });

  it("formatMailRowCountBadge empty when no unclaimed attachments", () => {
    expect(formatMailRowCountBadge({ mail_id: 3, status: 1 })).toBe("");
  });
});
