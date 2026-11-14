import { expect, it } from "vitest";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  buildSubmitRequest, canOfferFirstCityContinue, canOfferFirstCitySubmit, formatFirstCityCommandStatus,
} from "./firstCityServerSelectCommand";
import type { FirstCityScope } from "@/net/firstCityCanonical";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 1n, accountId: 2n };
const empty = () => createFirstCityKnowledge(scope);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

it("gates submit on empty durable head only", () => {
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
