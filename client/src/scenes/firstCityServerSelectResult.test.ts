import { expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import {
  buildGetResultRequest, canOfferFirstCityResult, formatFirstCityResultStatus, suggestFirstCityResultCommandId,
} from "./firstCityServerSelectResult";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 1n, accountId: 2n };
const a = "22222222-2222-4222-8222-222222222222";
const empty = () => createFirstCityKnowledge(scope);

it("prefills commandId from durable head or latest local intent", () => {
  const intent = createFirstCityIntent(scope, { commandId: a, predecessor: { kind: "empty" }, name: "城", x: 1, y: 2 });
  const record = {
    intent,
    template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
    state: { kind: "pending" as const },
  };
  expect(suggestFirstCityResultCommandId({ ...empty(), head: { kind: "command", record }, records: [record] })).toBe(a);
  expect(suggestFirstCityResultCommandId({ ...empty(), intents: [intent] })).toBe(a);
});

it("builds scoped get-result request", () => {
  const body = buildGetResultRequest(empty(), a) as { expectedScope: FirstCityScope; commandId: string };
  expect(body.commandId).toBe(a);
  expect(body.expectedScope).toEqual(scope);
});

it("gates get-result on valid UUID and available knowledge", () => {
  expect(canOfferFirstCityResult(empty(), a)).toBe(true);
  expect(canOfferFirstCityResult(null, a)).toBe(false);
  expect(canOfferFirstCityResult({ ...empty(), unavailable: true }, a)).toBe(false);
  expect(canOfferFirstCityResult(empty(), "not-a-uuid")).toBe(false);
});

it("formats NOT_OBSERVED, pending and succeeded without playable completion claims", () => {
  const base = empty();
  const notObserved = {
    ...base,
    observations: [{
      kind: "notObserved" as const, scope, requestedCommandId: a, command: null, head: { kind: "empty" as const },
    }],
  };
  expect(formatFirstCityResultStatus(notObserved, a)).toMatch(/NOT_OBSERVED/);
  const intent = createFirstCityIntent(scope, { commandId: a, predecessor: { kind: "empty" }, name: "城", x: 0, y: 0 });
  const pending = {
    ...base,
    observations: [{
      kind: "command" as const, scope, requestedCommandId: a,
      command: {
        intent,
        template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
        state: { kind: "pending" as const },
      },
      head: { kind: "empty" as const },
    }],
    records: [{
      intent,
      template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
      state: { kind: "pending" as const },
    }],
  };
  expect(formatFirstCityResultStatus(pending, a)).toMatch(/pending/);
  const succeeded = {
    ...pending,
    observations: [{
      kind: "command" as const, scope, requestedCommandId: a,
      command: {
        intent,
        template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
        state: { kind: "succeeded" as const, cityId: 1n, shard: 1, playerId: 1n, isCapital: true, wallLevel: 1, morale: 100 },
      },
      head: { kind: "empty" as const },
    }],
    records: [{
      intent,
      template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
      state: { kind: "succeeded" as const, cityId: 1n, shard: 1, playerId: 1n, isCapital: true, wallLevel: 1, morale: 100 },
    }],
  };
  const text = formatFirstCityResultStatus(succeeded, a);
  expect(text).toMatch(/succeeded/);
  expect(text).toMatch(/不宣称可玩首城/);
});
