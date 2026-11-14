// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getProtoRoot } from "./loadProto";
import { createFirstCityIntent } from "./firstCityCanonical";
import { decodeFirstCityResponse } from "./firstCityResponseCodec";
import type { FirstCityResponse } from "./firstCityResponseCodec";
import { createFirstCityKnowledge, reduceFirstCityKnowledge as reduce } from "./firstCityKnowledge";
import type { FirstCityEvidence, FirstCityKnowledge } from "./firstCityKnowledge";

const scope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1,
  playerId: 9007199254740993n, accountId: 9223372036854775807n };
const uuid = (n: number) => `22222222-2222-4222-8222-${n.toString(16).padStart(12, "0")}`;
const a = uuid(1), b = uuid(2), c = uuid(3), d = uuid(4);
const wireScope = (s = scope) => ({ realm_id: s.realmId, server_id: s.shard,
  player_id: String(s.playerId), account_id: String(s.accountId) });
function wire(command = a, state = "pending", predecessor?: string, s = scope) {
  return {
    canonical: { scope: wireScope(s), operation: "world.first_city", operation_version: 2, canonical_version: 1,
      proposal: { command_id: command, name: "城é", x: 0, y: 499,
        predecessor: predecessor ? { rejected_command_id: predecessor } : { empty: {} } } },
    template: { template_version: "t1", rules_version: "r1", catalog_version: "c1",
      content_encoding_version: 1, content_sha256: new Uint8Array(32) },
    ...(state === "pending" ? { pending: {} } : state === "rejected" ? { rejected_no_effect: { reason: 1 } } :
      { succeeded: { city_id: "9223372036854775807", server_id: s.shard, player_id: String(s.playerId),
        is_capital: true, wall_level: 1, morale: 100 } }),
  };
}
function decoded(name: string, value: object): FirstCityResponse {
  const type = getProtoRoot().lookupType(`sanguo.world.v2.${name}Response`);
  return decodeFirstCityResponse(`world.v2.${name}`, type.encode(type.fromObject(value)).finish());
}
const discovery = (value: ReturnType<typeof wire> | null = null, s = scope) =>
  decoded("DiscoverFirstCityIntent", { scope: wireScope(s), head: value ? { command: value } : { empty: {} } });
function result(command: ReturnType<typeof wire> | null, head: ReturnType<typeof wire> | null, requested = a, kind = 1) {
  const name = kind === 2 || kind === 3 ? "SubmitFirstCity" : "GetFirstCityResult";
  return decoded(name, { outcome: { scope: wireScope(), kind, requested_command_id: requested,
    ...(command ? { command } : {}), head: head ? { command: head } : { empty: {} } } });
}
const evidence = (...observations: FirstCityResponse[]): FirstCityEvidence => ({ intents: [], observations, unavailable: false });
const start = () => createFirstCityKnowledge(scope);
const apply = (...values: FirstCityResponse[]) => reduce(start(), evidence(...values));
const headId = (value: FirstCityKnowledge) => value.head?.kind === "command" ? value.head.record.intent.proposal.commandId : value.head?.kind;
const local = (command = a, name = "城é") => createFirstCityIntent(scope,
  { commandId: command, name, x: 0, y: 499, predecessor: { kind: "empty" } });
const serialize = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === "bigint" ? String(v) : v);
const permutations = <T>(values: T[]): T[][] => values.length ? values.flatMap((value, i) =>
  permutations(values.filter((_, j) => i !== j)).map(rest => [value, ...rest])) : [[]];

describe("monotonic first-city knowledge without execution policy", () => {
  it("distinguishes no observation from EMPTY and never manufactures eligibility", () => {
    expect(start()).toMatchObject({ head: null, records: [], unavailable: false, incomplete: false });
    const state = apply(discovery());
    expect(state.head).toEqual({ kind: "empty" });
    expect(Object.keys(state).sort()).toEqual(["head", "incomplete", "intents", "observations", "records", "scope", "unavailable"]);
  });
  it.each(["succeeded", "rejected"])("keeps %s after every ordering of pending and EMPTY", state => {
    const observations = [discovery(wire()), discovery(wire(a, state)), discovery()];
    const expected = serialize(apply(...observations));
    for (const order of permutations(observations)) {
      const knowledge = order.reduce((prior, value) => reduce(prior, evidence(value)), start());
      expect(serialize(knowledge)).toBe(expected);
      expect(knowledge.records).toHaveLength(1);
      expect(knowledge.records[0].state.kind).toBe(state);
      expect(headId(knowledge)).toBe(a);
      expect(reduce(knowledge, evidence(...order))).toEqual(knowledge);
    }
  });
  it("retains original local C1 through UNKNOWN, NOT_OBSERVED, EMPTY and missing snapshot entries", () => {
    const intent = local();
    let state = reduce(start(), { ...evidence(), intents: [intent] });
    state = reduce(state, evidence(result(null, null, a, 4), discovery()));
    state = reduce(state, evidence());
    expect(state.intents).toHaveLength(1);
    expect(state.intents[0].matches(intent.encode())).toBe(true);
    expect(state.records).toEqual([]);
    expect(state.head).toEqual({ kind: "empty" });
    expect(state.unavailable).toBe(false);
  });
  it("keeps multiple losing locals separate from the actual canonical winner", () => {
    const winner = wire(c); winner.canonical.proposal.name = "Canonical winner";
    const state = reduce(start(), { ...evidence(result(null, winner, a, 3)), intents: [local(a), local(b)] });
    expect(state.intents.map(x => x.proposal.commandId)).toEqual([a, b]);
    expect(headId(state)).toBe(c);
    expect(state.records[0].intent.proposal.name).toBe("Canonical winner");
    expect(state.unavailable).toBe(false);
  });
  it("retains same-ID content-conflicting local separately without corrupting the server record", () => {
    const canonical = wire();
    const state = reduce(start(), { ...evidence(result(canonical, canonical, a, 2)), intents: [local(a, "Other content")] });
    expect(state.intents[0].proposal.name).toBe("Other content");
    expect(state.records[0].intent.proposal.name).toBe("城é");
    expect(state.unavailable).toBe(false);
  });
  it("orders direct successors and old historical replay in every arrival order", () => {
    const first = wire(a, "rejected"), next = wire(b, "rejected", a), last = wire(c, "pending", b);
    const values = [discovery(first), discovery(next), result(first, last)];
    for (const order of permutations(values)) {
      const state = order.reduce((prior, value) => reduce(prior, evidence(value)), start());
      expect(headId(state)).toBe(c);
      expect(state.unavailable).toBe(false);
      expect(state.incomplete).toBe(false);
      expect(state.records).toHaveLength(3);
    }
  });
  it("blocks disconnected heads until a validated response bridges missing ancestry", () => {
    const older = wire(a, "rejected"), later = wire(c, "pending", b);
    const partial = apply(discovery(older), discovery(later));
    expect(partial).toMatchObject({ head: null, incomplete: true, unavailable: false });
    const resolved = reduce(partial, evidence(result(older, later)));
    expect(headId(resolved)).toBe(c);
    expect(resolved.incomplete).toBe(false);
    expect(resolved.records.map(x => x.intent.proposal.commandId)).not.toContain(b);
  });
  it("can bridge missing ancestry by reading its intermediate rejected record", () => {
    const partial = apply(discovery(wire(a, "rejected")), discovery(wire(c, "pending", b)));
    const resolved = reduce(partial, evidence(discovery(wire(b, "rejected", a))));
    expect(headId(resolved)).toBe(c);
    expect(resolved).toMatchObject({ incomplete: false, unavailable: false });
  });
  it("accepts a successor after a stale pending snapshot without inventing a rejection reason", () => {
    const state = apply(discovery(wire()), discovery(wire(b, "pending", a)));
    expect(headId(state)).toBe(b);
    expect(state.records.find(x => x.intent.proposal.commandId === a)?.state).toEqual({ kind: "pending" });
    expect(state.unavailable).toBe(false);
  });
  it.each(["name", "predecessor", "template", "success", "reason", "terminal"])("quarantines contradictory %s and retains facts", field => {
    const first = wire(a, field === "reason" || field === "terminal" ? "rejected" : "succeeded");
    const second = structuredClone(first);
    if (field === "name") second.canonical.proposal.name = "different";
    if (field === "predecessor") second.canonical.proposal.predecessor = { rejected_command_id: b };
    if (field === "template") second.template.rules_version = "r2";
    if (field === "success") second.succeeded!.city_id = "1";
    if (field === "reason") second.rejected_no_effect!.reason = 2;
    const other = field === "terminal" ? wire(a, "succeeded") : second;
    for (const pair of permutations([discovery(first), discovery(other)])) {
      const state = apply(...pair);
      expect(state.unavailable).toBe(true);
      expect(state.head).toBeNull();
      expect(state.records).toHaveLength(2);
      expect(reduce(state, evidence(discovery())).unavailable).toBe(true);
    }
  });
  it.each([undefined, a])("rejects competing accepted children of %s", parent => {
    const state = apply(discovery(wire(b, "pending", parent)), discovery(wire(c, "pending", parent)));
    expect(state).toMatchObject({ unavailable: true, head: null });
    expect(state.records).toHaveLength(2);
  });
  it("detects cycles, success successors and disjoint successes without losing receipts", () => {
    for (const values of [
      [wire(a, "rejected", b), wire(b, "rejected", a)],
      [wire(a, "succeeded"), wire(b, "pending", a)],
      [wire(a, "succeeded", b), wire(c, "succeeded", d)],
    ]) expect(apply(...values.map(value => discovery(value)))).toMatchObject({ unavailable: true, head: null });
  });
  it("reduces deep reverse-ordered lineages without recursion or head rewind", () => {
    const values = Array.from({ length: 180 }, (_, i) => discovery(wire(uuid(i + 1), i === 179 ? "pending" : "rejected", i ? uuid(i) : undefined)));
    const state = apply(...values.reverse());
    expect(headId(state)).toBe(uuid(180));
    expect(state.records).toHaveLength(180);
    expect(state).toMatchObject({ unavailable: false, incomplete: false });
  });
  it.each(["known", "unknown"])("rejects history crossing exact adjacency with %s root", root => {
    const values = root === "known" ? [discovery(wire(a, "rejected")), result(wire(d, "rejected", c), wire(b, "pending", a), d)] : [
      result(wire(a, "rejected", uuid(5)), wire(d, "pending", c)),
      result(wire(c, "rejected", uuid(6)), wire(b, "pending", a), c),
      result(wire(b, "rejected", a), wire(d, "pending", c), b),
    ];
    for (const order of permutations(values)) {
      for (const state of [apply(...order), order.reduce((prior, value) => reduce(prior, evidence(value)), start())]) {
        expect(state).toMatchObject({ unavailable: true, head: null });
        expect(state.records.map(value => value.intent.proposal.commandId)).toContain(d);
        expect(reduce(state, evidence(discovery())).unavailable).toBe(true);
      }
    }
  });
  it("orders complete adjacent blocks but rejects a successful block with a later command", () => {
    const latest = wire(d, "pending", c);
    const state = apply(discovery(wire(b, "rejected", a)), result(wire(a, "rejected"), latest));
    expect(state).toMatchObject({ unavailable: false, incomplete: false });
    expect(headId(state)).toBe(d);
    const succeeded = apply(discovery(wire(b, "succeeded", a)), result(wire(a, "rejected"), latest));
    expect(succeeded).toMatchObject({ unavailable: true, head: null });
    expect(succeeded.records.find(value => value.intent.proposal.commandId === b)?.state.kind).toBe("succeeded");
  });
  it.each([false, true])("quarantines disconnected accepted history after complete success ancestry: %s", extended => {
    const success = extended ? wire(b, "succeeded", a) : wire(a, "succeeded");
    const values = [discovery(success), discovery(wire(d, "pending", c)),
      ...(extended ? [discovery(wire(a, "rejected"))] : [])];
    for (const order of permutations(values)) {
      const state = order.reduce((prior, value) => reduce(prior, evidence(value)), start());
      expect(state).toMatchObject({ unavailable: true, head: null });
      expect(state.records.some(value => value.state.kind === "succeeded")).toBe(true);
      expect(reduce(state, evidence()).unavailable).toBe(true);
    }
    const unknown = apply(discovery(wire(b, "succeeded", a)), discovery(wire(d, "rejected", c)));
    expect(unknown).toMatchObject({ unavailable: false, incomplete: true, head: null });
  });
  it.each(["realmId", "shard", "playerId", "accountId"] as const)("isolates foreign %s without retaining its records", field => {
    const foreign = { ...scope, [field]: field === "realmId" ? uuid(90) : field === "shard" ? 2 : 1n };
    const before = apply(discovery(wire(a, "succeeded")));
    const state = reduce(before, evidence(discovery(wire(b, "pending", undefined, foreign), foreign)));
    expect(state.unavailable).toBe(true);
    expect(state.records).toEqual(before.records);
    expect(state.observations).toEqual(before.observations);
    const foreignIntent = createFirstCityIntent(foreign, local().proposal);
    expect(reduce(start(), { ...evidence(), intents: [foreignIntent] }).intents).toEqual([]);
  });
  it("keeps unavailability sticky and preserves a known terminal through empty updates", () => {
    const before = apply(discovery(wire(a, "succeeded")));
    const failed = reduce(before, { ...evidence(), unavailable: true });
    const later = reduce(failed, evidence(discovery(), result(null, null, a, 4)));
    expect(later).toMatchObject({ unavailable: true, head: null });
    expect(later.records).toEqual(before.records);
    expect(later.records[0].state).toMatchObject({ cityId: 9223372036854775807n, playerId: 9007199254740993n });
  });
  it("owns immutable snapshots, full C1 bytes and lossless scope without mutating inputs", () => {
    const value = discovery(wire(a, "succeeded"));
    if (value.head.kind !== "command") throw Error("fixture");
    const mutable = { ...value, head: { ...value.head, record: { ...value.head.record,
      template: { ...value.head.record.template }, state: { ...value.head.record.state } } } };
    const inputs = [local()], observations = [mutable];
    const state = reduce(start(), { intents: inputs, observations, unavailable: false });
    mutable.head.record.template.rulesVersion = "changed";
    inputs.length = 0; observations.length = 0;
    expect(state.records[0].template.rulesVersion).toBe("r1");
    state.intents[0].encode().fill(0);
    expect(state.intents[0].matches(local().encode())).toBe(true);
    for (const object of [state, state.scope, state.intents, state.observations, state.records, state.head,
      state.records[0], state.records[0].template, state.records[0].state, state.records[0].intent.proposal]) {
      expect(Object.isFrozen(object)).toBe(true);
    }
    expect(scope.playerId).toBe(9007199254740993n);
    expect(state.scope.accountId).toBe(9223372036854775807n);
  });
});
