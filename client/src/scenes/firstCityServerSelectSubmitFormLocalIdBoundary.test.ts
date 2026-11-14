import { describe, expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityProposalFormInput } from "./firstCityServerSelectProposalFormBoundary";
import {
  formatFirstCitySubmitFormLocalIdBoundaryPanel,
  resolveFirstCitySubmitFormLocalIdBoundaryView,
} from "./firstCityServerSelectSubmitFormLocalIdBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};
const commandId = "22222222-2222-4222-8222-222222222222";

function emptyHeadWithLocal(localName = "本地保留城", x = 8, y = 9) {
  const intent = createFirstCityIntent(scope, {
    commandId,
    predecessor: { kind: "empty" },
    name: localName,
    x,
    y,
  });
  return {
    ...createFirstCityKnowledge(scope),
    head: { kind: "empty" as const },
    intents: [intent],
    incomplete: false,
    unavailable: false,
  };
}

const mismatchForm: FirstCityProposalFormInput = { name: "表单草稿", x: 60, y: 60 };
const matchForm: FirstCityProposalFormInput = { name: "本地保留城", x: 8, y: 9 };

describe("resolveFirstCitySubmitFormLocalIdBoundaryView", () => {
  it("reports new-id when form matches latest local intent on EMPTY head", () => {
    const view = resolveFirstCitySubmitFormLocalIdBoundaryView(emptyHeadWithLocal(), matchForm);
    expect(view.kind).toBe("new-id");
    if (view.kind !== "new-id") return;
    expect(view.localCommandId).toBe(commandId);
    expect(view.localName).toBe("本地保留城");
  });

  it("returns none when form differs, without local intent, or on command head", () => {
    const knowledge = emptyHeadWithLocal();
    expect(resolveFirstCitySubmitFormLocalIdBoundaryView(knowledge, mismatchForm).kind).toBe("none");
    expect(resolveFirstCitySubmitFormLocalIdBoundaryView({ ...knowledge, intents: [] }, matchForm).kind).toBe("none");
    const record = {
      intent: createFirstCityIntent(scope, { commandId, predecessor: { kind: "empty" }, name: "h", x: 1, y: 2 }),
      template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
      state: { kind: "pending" as const },
    };
    expect(
      resolveFirstCitySubmitFormLocalIdBoundaryView(
        { ...knowledge, head: { kind: "command", record }, intents: [] },
        matchForm,
      ).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const base = emptyHeadWithLocal();
  expect(resolveFirstCitySubmitFormLocalIdBoundaryView(null, matchForm).reason).toBe("no-knowledge");
  expect(resolveFirstCitySubmitFormLocalIdBoundaryView(base, matchForm, true).reason).toBe("stale-actor");
  expect(formatFirstCitySubmitFormLocalIdBoundaryPanel({ ...base, unavailable: true }, matchForm)).toMatch(/不可用/);
  expect(formatFirstCitySubmitFormLocalIdBoundaryPanel({ ...base, incomplete: true, head: null }, matchForm)).toMatch(/不完整/);
});

it("formats new-id copy with retained commandId", () => {
  const text = formatFirstCitySubmitFormLocalIdBoundaryPanel(emptyHeadWithLocal(), matchForm);
  expect(text).toMatch(/Submit commandId 边界/);
  expect(text).toMatch(commandId);
  expect(text).toMatch(/生成新 commandId/);
  expect(text).toMatch(/本地保留城/);
});