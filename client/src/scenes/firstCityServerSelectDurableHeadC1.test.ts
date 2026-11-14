import { describe, expect, it } from "vitest";
import { createFirstCityIntent, type FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge, reduceFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityDurableHeadC1Panel,
  resolveFirstCityDurableHeadC1View,
} from "./firstCityServerSelectDurableHeadC1";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 7n, accountId: 44n };
const template = {
  templateVersion: "v1",
  rulesVersion: "r1",
  catalogVersion: "c1",
  contentEncodingVersion: 1,
  contentSha256: "abcdef",
};

const empty = () => createFirstCityKnowledge(scope);

function headKnowledge(state: "pending" | "succeeded" | "rejected") {
  const intent = createFirstCityIntent(scope, {
    commandId: "22222222-2222-4222-8222-222222222222",
    predecessor: { kind: "empty" },
    name: "城",
    x: 0,
    y: 1,
  });
  const record =
    state === "pending"
      ? { intent, template, state: { kind: "pending" as const } }
      : state === "succeeded"
        ? {
            intent,
            template,
            state: {
              kind: "succeeded" as const,
              cityId: 9n,
              shard: 1,
              playerId: 7n,
              isCapital: true as const,
              wallLevel: 1 as const,
              morale: 100 as const,
            },
          }
        : {
            intent,
            template,
            state: { kind: "rejected" as const, reason: "terrain" as const },
          };
  const discovery = { kind: "discovery" as const, scope, head: { kind: "command" as const, record } };
  return reduceFirstCityKnowledge(empty(), {
    intents: [],
    observations: [discovery],
    unavailable: false,
  });
}

describe("resolveFirstCityDurableHeadC1View", () => {
  it("withholds without knowledge or stale actor", () => {
    expect(resolveFirstCityDurableHeadC1View(null)).toEqual({ kind: "withheld", reason: "no-knowledge" });
    expect(resolveFirstCityDurableHeadC1View(headKnowledge("pending"), true)).toEqual({
      kind: "withheld",
      reason: "stale-actor",
    });
  });

  it("shows C1 byte length and hex prefix for a command head", () => {
    const knowledge = headKnowledge("pending");
    const view = resolveFirstCityDurableHeadC1View(knowledge);
    expect(view.kind).toBe("c1");
    if (view.kind !== "c1") return;
    const bytes = knowledge.head!.kind === "command" ? knowledge.head.record.intent.encode() : new Uint8Array();
    expect(view.byteLength).toBe(bytes.length);
    expect(view.hexPrefix).toMatch(/^53474643/);
    expect(view.commandId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("returns none for empty durable head", () => {
    const discovery = { kind: "discovery" as const, scope, head: { kind: "empty" as const } };
    const knowledge = reduceFirstCityKnowledge(empty(), { intents: [], observations: [discovery], unavailable: false });
    expect(resolveFirstCityDurableHeadC1View(knowledge)).toEqual({ kind: "none" });
    expect(formatFirstCityDurableHeadC1Panel(knowledge)).toBe("");
  });
});

it("mentions C1 is not proposal display", () => {
  const text = formatFirstCityDurableHeadC1Panel(headKnowledge("succeeded"));
  expect(text).toMatch(/durable head C1/);
  expect(text).toMatch(/bytes/);
  expect(text).toMatch(/不等同于 proposal/);
  expect(text).not.toMatch(/进入主城/);
});
