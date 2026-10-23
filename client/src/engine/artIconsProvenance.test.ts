import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const provenancePath = path.join(
  repoRoot,
  "docs/art/samples/art-icons-003/asset-provenance.json",
);

const COMMIT_SHA_RE = /^[0-9a-f]{40}$/;

describe("art-icons-003 asset provenance", () => {
  it("records full commit SHAs for wood/iron/stone icons (not branch names)", () => {
    const doc = JSON.parse(readFileSync(provenancePath, "utf8")) as {
      assets: Record<string, { provenance_commit: string }>;
    };
    const ids = ["res.icon.wood.v1", "res.icon.iron.v1", "res.icon.stone.v1"];
    for (const id of ids) {
      const commit = doc.assets[id]?.provenance_commit;
      expect(commit, id).toBeDefined();
      expect(commit, id).toMatch(COMMIT_SHA_RE);
      expect(commit, id).not.toMatch(/[/\\]/);
    }
    expect(new Set(ids.map((id) => doc.assets[id].provenance_commit)).size).toBe(1);
    expect(doc.assets["res.icon.wood.v1"].provenance_commit).toBe(
      "02399f6fe5bc72fd0f4fe9ce4791f08798f6c178",
    );
  });
});
