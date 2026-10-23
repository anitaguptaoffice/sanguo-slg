import { describe, expect, it } from "vitest";
import {
  applyMailClaimResult,
  formatHeroLine,
  formatMailLine,
  heroListLines,
  mailListLines,
  upsertMailRow,
} from "@/net/heroMailState";

describe("heroMailState", () => {
  it("shows empty placeholders", () => {
    expect(heroListLines([])).toEqual(["（尚无将领，可尝试招募）"]);
    expect(mailListLines([])).toEqual(["（空）"]);
  });

  it("formats hero and mail lines", () => {
    expect(formatHeroLine({ hero_id: 9, template_cfg_id: 1001, level: 3, loyalty: 88 })).toContain("刘备");
    expect(formatMailLine({ mail_id: 1, title: "奖", status: 0 })).toContain("未读");
  });

  it("applyMailClaimResult merges wallet and marks mail claimed", () => {
    const mails = [{ mail_id: 42, title: "t", status: 0 }];
    const patch = applyMailClaimResult(
      mails,
      42,
      {
        mail: { mail_id: 42, status: 2, claimed_at_ms: 1 },
        granted: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
        wallet_after: { food: 999 },
      },
      { bag: [], wallet: { food: 100 } },
    );
    expect(patch.mails[0].status).toBe(2);
    expect(patch.wallet.food).toBe(999);
    expect(patch.bag).toEqual([{ item_cfg_id: 2001, quantity: 1 }]);
  });

  it("upsertMailRow replaces existing row", () => {
    const next = upsertMailRow([{ mail_id: 1, status: 0 }], { mail_id: 1, status: 1 });
    expect(next).toEqual([{ mail_id: 1, status: 1 }]);
  });
});
