import { expect, it } from "vitest";
import { createFirstCityKnowledge, reduceFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  buildSubmitRequest, canOfferFirstCityContinue, canOfferFirstCitySubmit, formatFirstCityCommandStatus,
} from "./firstCityServerSelectCommand";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityRecord } from "@/net/firstCityResponseCodec";
import type { FirstCityScope } from "@/net/firstCityCanonical";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 1n, accountId: 2n };
const empty = () => createFirstCityKnowledge(scope);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

it("gates initial submit on an observed empty durable head", () => {
  expect(canOfferFirstCitySubmit({ ...empty(), head: { kind: "empty" } })).toBe(true);
  expect(canOfferFirstCitySubmit({ ...empty(), head: null })).toBe(false);
});
it("builds submit request with a fresh command UUID", () => {
  const body = buildSubmitRequest({ ...empty(), head: { kind: "empty" } }, { name: "城", x: 1, y: 2 }) as any;
  expect(uuid.test(body.proposal.commandId)).toBe(true);
  expect(body.proposal.name).toBe("城");
});
it("offers continue only for pending head command", () => {
  const intent = buildSubmitRequest({ ...empty(), head: { kind: "empty" } }, { name: "城", x: 0, y: 1 }) as any;
  const record = { intent: { scope, proposal: intent.proposal, encode: () => new Uint8Array(8), matches: () => true },
    template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
    state: { kind: "pending" as const } };
  expect(canOfferFirstCityContinue({ ...empty(), head: { kind: "command", record }, records: [record], incomplete: false })).toBe(true);
});
it("does not claim production success in status text", () => {
  expect(formatFirstCityCommandStatus({ ...empty(), head: { kind: "empty" } })).toMatch(/未进入主城/);
});

const previousId = "33333333-3333-4333-8333-333333333333";
function rejectedKnowledge(reason: "terrain" | "coordinateOccupied" = "terrain") {
  const intent = createFirstCityIntent(scope, { commandId: previousId,
    predecessor: { kind: "empty" }, name: "城", x: 70, y: 70 });
  const record: FirstCityRecord = { intent, template: { templateVersion: "v1", rulesVersion: "r1",
    catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00".repeat(32) },
    state: { kind: "rejected", reason } };
  return reduceFirstCityKnowledge(empty(), { intents: [intent], unavailable: false,
    observations: [{ kind: "discovery", scope, head: { kind: "command", record } }] });
}
it.each(["terrain", "coordinateOccupied"] as const)("permits an explicit successor after %s rejection", reason => {
  const k = rejectedKnowledge(reason), before = k.intents[0].encode();
  expect(canOfferFirstCitySubmit(k)).toBe(true);
  expect(canOfferFirstCityContinue(k)).toBe(false);
  const body = buildSubmitRequest(k, { name: "新城", x: 71, y: 70 }) as any;
  expect(body.proposal.predecessor).toEqual({ kind: "rejected", commandId: previousId });
  expect(body.proposal.commandId).toMatch(uuid);
  expect(body.proposal.commandId).not.toBe(previousId);
  expect(body.proposal.x).toBe(71);
  expect(k.intents[0].encode()).toEqual(before);
  expect(formatFirstCityCommandStatus(k)).toContain(reason === "terrain" ? "地形" : "占用");
  expect(formatFirstCityCommandStatus(k)).toContain("更换坐标");
});
it("blocks an unacknowledged local successor even when the last observed head was rejected", () => {
  const k = rejectedKnowledge();
  const intent = createFirstCityIntent(scope, { commandId: "44444444-4444-4444-8444-444444444444",
    predecessor: { kind: "rejected", commandId: previousId }, name: "新城", x: 71, y: 70 });
  const next = reduceFirstCityKnowledge(k, { intents: [intent], observations: [], unavailable: false });
  expect(canOfferFirstCitySubmit(next)).toBe(false);
  expect(() => buildSubmitRequest(next, { name: "城", x: 72, y: 70 })).toThrow();
  expect(formatFirstCityCommandStatus(next)).not.toContain("更换坐标");
});
it("does not use a historical rejection when the current successor is pending", () => {
  const k = rejectedKnowledge();
  const intent = createFirstCityIntent(scope, { commandId: "44444444-4444-4444-8444-444444444444",
    predecessor: { kind: "rejected", commandId: previousId }, name: "新城", x: 71, y: 70 });
  const record: FirstCityRecord = { ...k.records[0], intent, state: { kind: "pending" } };
  const next = reduceFirstCityKnowledge(k, { intents: [intent], unavailable: false,
    observations: [{ kind: "discovery", scope, head: { kind: "command", record } }] });
  expect(canOfferFirstCitySubmit(next)).toBe(false);
  expect(canOfferFirstCityContinue(next)).toBe(true);
  expect(formatFirstCityCommandStatus(next)).not.toContain("更换坐标");
});
it.each(["unavailable", "incomplete"] as const)("rejects %s knowledge rather than offering a successor", key => {
  const k = { ...rejectedKnowledge(), [key]: true };
  expect(canOfferFirstCitySubmit(k)).toBe(false);
  expect(() => buildSubmitRequest(k, { name: "城", x: 71, y: 70 })).toThrow();
});

it("does not offer another city after a successful successor", () => {
  const k = rejectedKnowledge();
  const intent = createFirstCityIntent(scope, { commandId: "44444444-4444-4444-8444-444444444444",
    predecessor: { kind: "rejected", commandId: previousId }, name: "新城", x: 71, y: 70 });
  const record: FirstCityRecord = { ...k.records[0], intent, state: { kind: "succeeded", cityId: 3n,
    shard: 1, playerId: 1n, isCapital: true, wallLevel: 1, morale: 100 } };
  const next = reduceFirstCityKnowledge(k, { intents: [intent], unavailable: false,
    observations: [{ kind: "discovery", scope, head: { kind: "command", record } }] });
  expect(canOfferFirstCitySubmit(next)).toBe(false);
  expect(canOfferFirstCityContinue(next)).toBe(false);
  expect(formatFirstCityCommandStatus(next)).toContain("首城已创建");
  expect(() => buildSubmitRequest(next, { name: "城", x: 72, y: 70 })).toThrow();
});

it("recovers a rejected winning head after another tab wins the predecessor CAS", () => {
  const k = rejectedKnowledge();
  const proposal = { predecessor: { kind: "rejected" as const, commandId: previousId }, name: "新城", x: 71, y: 70 };
  const local = createFirstCityIntent(scope, { ...proposal, commandId: "44444444-4444-4444-8444-444444444444" });
  const winner = { ...k.records[0], intent: createFirstCityIntent(scope, {
    ...proposal, commandId: "55555555-5555-4555-8555-555555555555" }) };
  const next = reduceFirstCityKnowledge(k, { intents: [local], unavailable: false,
    observations: [{ kind: "headConflict", scope, requestedCommandId: local.proposal.commandId,
      command: null, head: { kind: "command", record: winner } }] });
  expect(next.unavailable).toBe(false);
  expect(next.records.some(r => r.intent.proposal.commandId === local.proposal.commandId)).toBe(false);
  expect(canOfferFirstCitySubmit(next)).toBe(true);
  const body = buildSubmitRequest(next, { name: "新城", x: 72, y: 70 }) as any;
  expect(body.proposal.predecessor).toEqual({ kind: "rejected", commandId: winner.intent.proposal.commandId });
  expect(next.intents.find(i => i.proposal.commandId === local.proposal.commandId)?.encode()).toEqual(local.encode());
});
