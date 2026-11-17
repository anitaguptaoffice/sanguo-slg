import { expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  canOfferFirstCityResult, formatFirstCityResultStatus, suggestResultCommandId,
} from "./firstCityServerSelectResult";
import type { FirstCityScope } from "@/net/firstCityCanonical";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 1n, accountId: 2n };
const commandId = "22222222-2222-4222-8222-222222222222";

it("suggests head or last intent command id", () => {
  const base = createFirstCityKnowledge(scope);
  const intent = createFirstCityIntent(scope, { commandId, predecessor: { kind: "empty" }, name: "城", x: 0, y: 1 });
  expect(suggestResultCommandId({ ...base, intents: [intent] })).toBe(commandId);
});
it("describes notObserved without implying success", () => {
  const base = createFirstCityKnowledge(scope);
  const message = formatFirstCityResultStatus({
    ...base,
    observations: [{ kind: "notObserved", scope, requestedCommandId: commandId, command: null, head: { kind: "empty" } }],
  });
  expect(message).toContain("NOT_OBSERVED");
  expect(message).not.toContain("可玩");
});
it("refuses unavailable knowledge", () => {
  expect(canOfferFirstCityResult({ ...createFirstCityKnowledge(scope), unavailable: true })).toBe(false);
});
