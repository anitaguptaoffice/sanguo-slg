// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveHeroIdForRecruitTemplate } from "@/net/recruitHeroViewLink";

describe("resolveHeroIdForRecruitTemplate", () => {
  it("returns hero_id when player owns matching template", () => {
    expect(
      resolveHeroIdForRecruitTemplate(
        [{ hero_id: 7, template_cfg_id: 1002 }],
        1002,
      ),
    ).toBe(7);
  });

  it("returns null when template not owned (locked view)", () => {
    expect(resolveHeroIdForRecruitTemplate([], 1001)).toBeNull();
  });
});
