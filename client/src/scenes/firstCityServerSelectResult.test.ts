import { expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge, reduceFirstCityKnowledge } from "@/net/firstCityKnowledge";
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

it.each(["terrain", "coordinateOccupied"] as const)("reports %s rejection without using old history to authorize a successor", reason => {
  const intent = createFirstCityIntent(scope, { commandId, predecessor: { kind: "empty" }, name: "城", x: 70, y: 70 });
  const record = { intent, template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1",
    contentEncodingVersion: 1, contentSha256: "00".repeat(32) }, state: { kind: "rejected" as const, reason } };
  const current = reduceFirstCityKnowledge(createFirstCityKnowledge(scope), { intents: [intent], unavailable: false,
    observations: [{ kind: "command", scope, requestedCommandId: commandId, command: record,
      head: { kind: "command", record } }] });
  expect(formatFirstCityResultStatus(current)).toContain(reason === "terrain" ? "地形" : "占用");
  expect(formatFirstCityResultStatus(current)).toContain("更换坐标");
  const successor = { ...record, intent: createFirstCityIntent(scope, {
    commandId: "33333333-3333-4333-8333-333333333333", predecessor: { kind: "rejected", commandId },
    name: "新城", x: 71, y: 70 }), state: { kind: "pending" as const } };
  const historical = reduceFirstCityKnowledge(current, { intents: [successor.intent], unavailable: false,
    observations: [{ kind: "command", scope, requestedCommandId: commandId, command: record,
      head: { kind: "command", record: successor } }] });
  expect(formatFirstCityResultStatus(historical)).not.toContain("更换坐标");
  expect(formatFirstCityResultStatus(historical)).toContain("勿重复提交");
});
