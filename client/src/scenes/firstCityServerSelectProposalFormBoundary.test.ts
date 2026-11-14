import { describe, expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityProposalFormBoundaryPanel,
  resolveFirstCityProposalFormBoundaryView,
  type FirstCityProposalFormInput,
} from "./firstCityServerSelectProposalFormBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};
const commandId = "22222222-2222-4222-8222-222222222222";

function headKnowledge(state: "pending" | "succeeded" = "pending") {
  const intent = createFirstCityIntent(scope, {
    commandId,
    predecessor: { kind: "empty" },
    name: "规范Head城",
    x: 12,
    y: 34,
  });
  const record = {
    intent,
    template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
    state: { kind: state as const },
  };
  return {
    ...createFirstCityKnowledge(scope),
    head: { kind: "command" as const, record },
    records: [record],
    incomplete: false,
    unavailable: false,
  };
}

const mismatchForm: FirstCityProposalFormInput = { name: "表单草稿", x: 60, y: 60 };

describe("resolveFirstCityProposalFormBoundaryView", () => {
  it("reports mismatch when form differs from durable head proposal", () => {
    const view = resolveFirstCityProposalFormBoundaryView(headKnowledge(), mismatchForm);
    expect(view.kind).toBe("mismatch");
    if (view.kind !== "mismatch") return;
    expect(view.headName).toBe("规范Head城");
    expect(view.formName).toBe("表单草稿");
  });

  it("returns none when form matches head or head is empty", () => {
    const knowledge = headKnowledge();
    const match: FirstCityProposalFormInput = { name: "规范Head城", x: 12, y: 34 };
    expect(resolveFirstCityProposalFormBoundaryView(knowledge, match).kind).toBe("none");
    expect(
      resolveFirstCityProposalFormBoundaryView(
        { ...knowledge, head: { kind: "empty" } },
        mismatchForm,
      ).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const base = headKnowledge();
  expect(resolveFirstCityProposalFormBoundaryView(null, mismatchForm).reason).toBe("no-knowledge");
  expect(resolveFirstCityProposalFormBoundaryView(base, mismatchForm, true).reason).toBe("stale-actor");
  expect(formatFirstCityProposalFormBoundaryPanel({ ...base, unavailable: true }, mismatchForm)).toMatch(/不可用/);
  expect(formatFirstCityProposalFormBoundaryPanel({ ...base, incomplete: true, head: null }, mismatchForm)).toMatch(/不完整/);
});

it("formats mismatch copy with head and form labels", () => {
  const text = formatFirstCityProposalFormBoundaryPanel(headKnowledge(), mismatchForm);
  expect(text).toMatch(/提案表单边界/);
  expect(text).toMatch(/规范Head城/);
  expect(text).toMatch(/表单草稿/);
  expect(text).toMatch(/Continue 仅发送 head proposal/);
});