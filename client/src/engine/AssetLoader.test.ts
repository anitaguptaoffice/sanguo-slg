import { describe, expect, it } from "vitest";
import { PLACEHOLDER_TO_STABLE_ID, resolveArtPackUrl } from "@/engine/AssetLoader";

describe("resolveArtPackUrl", () => {
  it("joins base and relative path", () => {
    expect(resolveArtPackUrl("textures/1x/icons/food.png")).toBe(
      "/assets/art/v1/textures/1x/icons/food.png",
    );
  });
});

describe("PLACEHOLDER_TO_STABLE_ID", () => {
  it("maps legacy bg_maincity", () => {
    expect(PLACEHOLDER_TO_STABLE_ID.bg_maincity).toBe("mc.bg.plateau.v1");
  });
});
