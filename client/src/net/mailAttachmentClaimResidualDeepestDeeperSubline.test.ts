import { describe, expect, it } from "vitest";
import { formatMailAttachmentClaimResidualDeepestDeeperSubline } from "@/net/mailAttachmentClaimResidualDeepestDeeperSubline";

describe("formatMailAttachmentClaimResidualDeepestDeeperSubline (CLIENT-319)", () => {
  it("deepens CLIENT-303 residual deepest with attachment type and claim scan", () => {
    const line = formatMailAttachmentClaimResidualDeepestDeeperSubline(
      {
        mail_id: 1,
        status: 1,
        attachments: { items: [{ item_cfg_id: 2001, quantity: 2 }] },
      },
      { items: [{ item_cfg_id: 2001, quantity: 2 }] },
    );
    expect(line).toContain("巩固再加深二层");
    expect(line).toContain("↔");
    expect(line).toContain("巩固再加深一层");
    expect(line).toContain("对照");
    expect(line).toContain("已领");
    expect(line).toMatch(/2001|×2/);
  });

  it("returns null when no attachments and no grant payload", () => {
    expect(
      formatMailAttachmentClaimResidualDeepestDeeperSubline({ mail_id: 2, status: 2 }, undefined),
    ).toBeNull();
  });
});
