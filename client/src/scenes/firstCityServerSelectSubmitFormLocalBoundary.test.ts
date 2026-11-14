import { describe, expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityProposalFormInput } from "./firstCityServerSelectProposalFormBoundary";
import {
  formatFirstCitySubmitFormLocalBoundaryPanel,
  resolveFirstCitySubmitFormLocalBoundaryView,
} from "./firstCityServerSelectSubmitFormLocalBoundary";

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

describe("resolveFirstCitySubmitFormLocalBoundaryView", () => {
  it("reports mismatch when form differs from latest local intent on EMPTY head", () => {
    const view = resolveFirstCitySubmitFormLocalBoundaryView(emptyHeadWithLocal(), mismatchForm);
    expect(view.kind).toBe("mismatch");
    if (view.kind !== "mismatch") return;
    expect(view.commandId).toBe(commandId);
    expect(view.localName).toBe("本地保留城");
    expect(view.formName).toBe("表单草稿");
  });

  it("returns none without local intent, matching form, or command head", () => {
    const knowledge = emptyHeadWithLocal();
    expect(resolveFirstCitySubmitFormLocalBoundaryView({ ...knowledge, intents: [] }, mismatchForm).kind).toBe("none");
    const match: FirstCityProposalFormInput = { name: "本地保留城", x: 8, y: 9 };
    expect(resolveFirstCitySubmitFormLocalBoundaryView(knowledge, match).kind).toBe("none");
    const record = {
      intent: createFirstCityIntent(scope, { commandId, predecessor: { kind: "empty" }, name: "h", x: 1, y: 2 }),
      template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
      state: { kind: "pending" as const },
    };
    expect(
      resolveFirstCitySubmitFormLocalBoundaryView(
        { ...knowledge, head: { kind: "command", record }, intents: [] },
        mismatchForm,
      ).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const base = emptyHeadWithLocal();
  expect(resolveFirstCitySubmitFormLocalBoundaryView(null, mismatchForm).reason).toBe("no-knowledge");
  expect(resolveFirstCitySubmitFormLocalBoundaryView(base, mismatchForm, true).reason).toBe("stale-actor");
  expect(formatFirstCitySubmitFormLocalBoundaryPanel({ ...base, unavailable: true }, mismatchForm)).toMatch(/不可用/);
  expect(formatFirstCitySubmitFormLocalBoundaryPanel({ ...base, incomplete: true, head: null }, mismatchForm)).toMatch(/不完整/);
});

it("formats mismatch copy with local and form labels", () => {
  const text = formatFirstCitySubmitFormLocalBoundaryPanel(emptyHeadWithLocal(), mismatchForm);
  expect(text).toMatch(/Submit 表单边界/);
  expect(text).toMatch(/本地保留城/);
  expect(text).toMatch(/表单草稿/);
  expect(text).toMatch(/生成新 commandId/);
});