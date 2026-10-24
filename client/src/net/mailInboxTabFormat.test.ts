import { describe, expect, it } from "vitest";
import {
  MAIL_INBOX_FILTER_ALL,
  MAIL_INBOX_FILTER_UNCLAIMED,
  MAIL_INBOX_FILTER_UNREAD,
  type MailRow,
} from "@/net/heroMailState";
import {
  filterMailRowsForInboxTab,
  formatMailAttachmentTypeSweep,
  formatMailTabEmptyHint,
  mailInboxFilterToEmptyTab,
  resolveMailListPlayerMailFilter,
} from "@/net/mailInboxTabFormat";

describe("formatMailTabEmptyHint", () => {
  it("differentiates all / unread / unclaimed empty copy with dev seed hint", () => {
    expect(formatMailTabEmptyHint("all")).toContain("空收件箱");
    expect(formatMailTabEmptyHint("unread")).toContain("无未读");
    expect(formatMailTabEmptyHint("unclaimed")).toContain("未领附件");
    for (const tab of ["all", "unread", "unclaimed"] as const) {
      expect(formatMailTabEmptyHint(tab)).toContain("种子");
    }
  });

  it("mailInboxFilterToEmptyTab maps inbox filters", () => {
    expect(mailInboxFilterToEmptyTab(MAIL_INBOX_FILTER_ALL)).toBe("all");
    expect(mailInboxFilterToEmptyTab(MAIL_INBOX_FILTER_UNREAD)).toBe("unread");
    expect(mailInboxFilterToEmptyTab(MAIL_INBOX_FILTER_UNCLAIMED)).toBe("unclaimed");
  });

  it("resolveMailListPlayerMailFilter keeps unclaimed tab on ALL rpc", () => {
    expect(resolveMailListPlayerMailFilter(MAIL_INBOX_FILTER_UNCLAIMED)).toBe(MAIL_INBOX_FILTER_ALL);
    expect(resolveMailListPlayerMailFilter(MAIL_INBOX_FILTER_UNREAD)).toBe(MAIL_INBOX_FILTER_UNREAD);
  });

  it("filterMailRowsForInboxTab filters unclaimed client-side", () => {
    const rows: MailRow[] = [
      { mail_id: 1, status: 0, attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] } },
      { mail_id: 2, status: 2, has_unclaimed_attachments: false },
    ];
    expect(filterMailRowsForInboxTab(rows, MAIL_INBOX_FILTER_ALL)).toHaveLength(2);
    expect(filterMailRowsForInboxTab(rows, MAIL_INBOX_FILTER_UNCLAIMED)).toHaveLength(1);
  });
});

describe("formatMailAttachmentTypeSweep", () => {
  it("summarizes resource icons and item types for attachment rows", () => {
    const line = formatMailAttachmentTypeSweep({
      mail_id: 9,
      status: 0,
      attachments: {
        resources: { food: 100, gold: 5 },
        items: [{ item_cfg_id: 2001, quantity: 2 }],
      },
    });
    expect(line).toContain("📎");
    expect(line).toContain("🌾");
    expect(line).toContain("粮");
    expect(line).toContain("🎁");
    expect(line).toContain("谷袋");
  });

  it("shows claimed mark when attachments are fully claimed", () => {
    const line = formatMailAttachmentTypeSweep({
      mail_id: 10,
      status: 2,
      has_unclaimed_attachments: false,
      attachments: { items: [{ item_cfg_id: 2004, quantity: 1 }] },
    });
    expect(line.startsWith("✓")).toBe(true);
    expect(line).toContain("贤士名册");
  });
});
