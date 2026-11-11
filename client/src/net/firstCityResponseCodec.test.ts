// @vitest-environment node
import { describe, expect, it } from "vitest";
import protobuf from "protobufjs";
import { getProtoRoot } from "./loadProto";
import { decodeFirstCityResponse as decode } from "./firstCityResponseCodec";

const hex = (value: string) => Uint8Array.from(Buffer.from(value.replaceAll(" ", ""), "hex"));
const scope = hex("0a2431313131313131312d313131312d343131312d383131312d313131313131313131313131100118818080808080801020ffffffffffffffff7f");
const pending = hex(
  "0a89010a3b0a2431313131313131312d313131312d343131312d383131312d313131313131313131313131100118818080808080801020ffffffffffffffff7f" +
  "1210776f726c642e66697273745f63697479180220012a340a2432323232323232322d323232322d343232322d383232322d323232323232323232323232" +
  "12020a001a03e59f8e200028f30312300a027631120272311a02633120012a20000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f1a00",
);
const emptyDiscovery = hex(
  "0a3b0a2431313131313131312d313131312d343131312d383131312d313131313131313131313131" +
  "100118818080808080801020ffffffffffffffff7f12020a00",
);
const commandId = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";
const routes = ["SubmitFirstCity", "ContinueFirstCity", "GetFirstCityResult", "DiscoverFirstCityIntent"].map(x => `world.v2.${x}`);
function varint(value: bigint): number[] {
  const bytes: number[] = [];
  while (value > 127n) {
    bytes.push(Number(value & 127n) | 128);
    value >>= 7n;
  }
  return [...bytes, Number(value)];
}
function field(id: number, value: bigint | string | Uint8Array): Uint8Array {
  if (typeof value === "bigint") return Uint8Array.from([...varint(BigInt(id * 8)), ...varint(value)]);
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Uint8Array.from([...varint(BigInt(id * 8 + 2)), ...varint(BigInt(bytes.length)), ...bytes]);
}
const join = (...values: Uint8Array[]) => Uint8Array.from(values.flatMap(value => Array.from(value)));
function parts(bytes: Uint8Array) {
  const reader = protobuf.Reader.create(bytes);
  const result: { id: number; raw: Uint8Array; data: Uint8Array }[] = [];
  while (reader.pos < reader.len) {
    const start = reader.pos, tag = reader.uint32();
    const data = tag % 8 === 2 ? reader.bytes() : (reader.skipType(tag % 8), new Uint8Array());
    result.push({ id: tag >>> 3, raw: bytes.slice(start, reader.pos), data });
  }
  return result;
}
function edit(bytes: Uint8Array, path: number[], replacement: Uint8Array): Uint8Array {
  return join(...parts(bytes).map(part => part.id !== path[0] ? part.raw : path.length === 1 ? replacement :
    field(part.id, edit(part.data, path.slice(1), replacement))));
}
const discovery = (record = pending, s = scope) => join(field(1, s), field(2, field(2, record)));
const rejected = edit(pending, [3], field(5, field(1, 1n)));
const success = edit(pending, [3], field(4, hex("08ffffffffffffffff7f1001188180808080808010200128013064")));
function outcome(kind: number, command: Uint8Array | null = pending, head: Uint8Array | null = command, id = commandId) {
  return field(1, join(field(1, scope), field(2, BigInt(kind)), field(3, id),
    command ? field(4, command) : new Uint8Array(), field(5, head ? field(2, head) : hex("0a00"))));
}
const fails = (bytes: unknown, route = routes[3]) => expect(() => decode(route, bytes)).toThrow("Invalid first-city response");
const recordPath = [2, 2];
const after = (record: Uint8Array, id: string) => edit(record, [1, 5, 2], field(2, field(2, id)));

describe("complete first-city response payloads", () => {
  it("matches literal wire fixtures, adopted protobuf types and immutable lossless domain values", () => {
    expect(decode(routes[3], emptyDiscovery)).toMatchObject({ kind: "discovery", head: { kind: "empty" } });
    for (const value of [pending, success, rejected, edit(rejected, [5, 1], field(1, 2n))]) {
      const bytes = discovery(value);
      const type = getProtoRoot().lookupType("sanguo.world.v2.DiscoverFirstCityIntentResponse");
      expect(Uint8Array.from(type.encode(type.decode(bytes)).finish())).toEqual(bytes);
      const result = decode(routes[3], bytes);
      expect(result.scope.playerId).toBe(9007199254740993n);
      expect(result.scope.accountId).toBe(9223372036854775807n);
      if (result.head.kind !== "command") throw new Error("missing record");
      const record = result.head.record;
      expect(record.intent.proposal).toMatchObject({ commandId, name: "城", x: 0, y: 499 });
      expect(record.template.contentSha256).toBe("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
      if (record.state.kind === "succeeded") expect(record.state.cityId).toBe(9223372036854775807n);
      for (const object of [result, result.scope, result.head, record, record.template, record.state, record.intent.proposal]) {
        expect(Object.isFrozen(object)).toBe(true);
      }
      bytes.fill(0);
      expect(record.intent.proposal.name).toBe("城");
      expect(record.template.contentSha256).toHaveLength(64);
      expect(Reflect.set(record.template, "contentSha256", "bad")).toBe(false);
      expect(Reflect.set(record.state, "kind", "pending")).toBe(false);
      record.intent.encode().fill(0);
      expect(record.intent.encode()[0]).toBe(83);
    }
  });
  it("covers every route/outcome and preserves historical rejection without executing a winner", () => {
    const allowed = [[1, 2, 3], [1, 2, 4], [1, 4]];
    const winner = edit(pending, [1, 5, 1], field(1, otherId));
    for (let route = 0; route < 3; route++) for (let kind = 0; kind <= 5; kind++) {
      const bytes = outcome(kind, kind === 1 || kind === 2 ? pending : null, kind === 1 || kind === 2 ? pending : winner);
      const names = ["", "command", "idContentConflict", "headConflict", "notObserved"];
      if (allowed[route].includes(kind)) expect(decode(routes[route], bytes).kind).toBe(names[kind]);
      else fails(bytes, routes[route]);
    }
    expect(decode(routes[0], outcome(1, rejected, after(winner, commandId))).kind).toBe("command");
    for (const kind of [3, 4]) expect(decode(routes[kind === 3 ? 0 : 2], outcome(kind, null, null)).kind).toBeTruthy();
    for (const command of [pending, success]) fails(outcome(1, command, winner), routes[0]);
    fails(outcome(3, null, pending), routes[0]);
    fails(outcome(1, success, edit(success, [4, 1], field(1, 1n))), routes[0]);
    fails(outcome(1, rejected, edit(rejected, [5, 1], field(1, 2n))), routes[0]);
    for (const bytes of [outcome(1, null, pending), outcome(2, null, pending), outcome(3), outcome(4),
      outcome(1, pending, null), outcome(1, pending, pending, otherId), outcome(4, null, pending)]) fails(bytes, routes[1]);
    for (const path of [[1, 5, 3], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [3]]) {
      const replacement = path[0] === 3 ? field(5, field(1, 1n)) :
        field(path.at(-1)!, path[1] === 4 ? 2n : path[1] === 5 ? new Uint8Array(32) : "other");
      fails(outcome(1, pending, edit(pending, path, replacement)), routes[0]);
    }
  });
  it("rejects locally contradictory lineage without inventing missing history", () => {
    const thirdId = "44444444-4444-4444-8444-444444444444";
    const winner = edit(pending, [1, 5, 1], field(1, otherId));
    const successor = after(winner, commandId);
    const contradictions = [[rejected, winner], [after(rejected, otherId), successor],
      [after(rejected, thirdId), after(winner, thirdId)]];
    for (const [past, current] of contradictions) for (const [route, kind] of [[0, 1], [1, 2], [2, 1]]) {
      fails(outcome(kind, past, current), routes[route]);
    }
    for (const [route, kind] of [[0, 3], [1, 4], [2, 4]]) fails(outcome(kind, null, successor), routes[route]);
    for (const current of [successor, after(winner, thirdId)]) {
      expect(decode(routes[0], outcome(1, rejected, current)).kind).toBe("command");
    }
  });
  it("rejects every truncation, recursive presence loss, duplicate, unknown and wrong wire type", () => {
    let checked = 0;
    function hostile(bytes: Uint8Array, type: protobuf.Type, wrap: (part: Uint8Array) => Uint8Array, route: string) {
      const entries = parts(bytes);
      for (const tail of [hex("00"), hex("f80700"), hex("0b0c"), hex("8080808080808080808000")]) { fails(wrap(join(bytes, tail)), route); checked++; }
      for (const part of entries) {
        for (const replacement of [new Uint8Array(), join(part.raw, part.raw),
          Uint8Array.of(part.id * 8 + 5, 0, 0, 0, 0),
          join(Uint8Array.of(part.raw[0] | 128, 0), part.raw.slice(1)),
          Uint8Array.of(part.id * 8 + 1, 0, 0, 0, 0, 0, 0, 0, 0)]) {
          fails(wrap(edit(bytes, [part.id], replacement)), route); checked++;
        }
        const schema = type.fieldsById[part.id].resolve().resolvedType;
        if (schema instanceof protobuf.Type) hostile(part.data, schema, child => wrap(edit(bytes, [part.id], field(part.id, child))), route);
      }
      expect(() => decode(route, wrap(join(...entries.reverse().map(part => part.raw))))).not.toThrow();
    }
    for (const record of [pending, success, rejected]) {
      const bytes = outcome(1, record);
      for (let end = 0; end < bytes.length; end++) fails(bytes.slice(0, end), routes[0]);
      hostile(bytes, getProtoRoot().lookupType("sanguo.world.v2.SubmitFirstCityResponse"), x => x, routes[0]);
    }
    hostile(emptyDiscovery, getProtoRoot().lookupType("sanguo.world.v2.DiscoverFirstCityIntentResponse"), x => x, routes[3]);
    expect(checked).toBeGreaterThan(1000);
  });
  it("rejects semantic aliases, incomplete oneofs, malformed UTF8 and invalid widths at every layer", () => {
    const cases: [number[], (bigint | string | Uint8Array)[]][] = [
      [[1, 1, 1], ["11111111-1111-4111-8111-11111111111A"]], [[1, 1, 2], [0n, 2n, 2147483648n]],
      [[1, 1, 3], [0n, 1n, 9223372036854775808n]], [[1, 1, 4], [0n, 1n, 9223372036854775808n]],
      [[1, 2], ["world.first_city "]], [[1, 3], [0n, 1n, 4294967296n]], [[1, 4], [0n, 2n]],
      [[1, 5, 1], [(otherId.slice(0, -1) + "a").toUpperCase(), "bad"]],
      [[1, 5, 2], [new Uint8Array(), join(hex("0a00"), field(2, otherId)), field(2, commandId), hex("0a020800")]],
      [[1, 5, 3], ["", "\0", "x".repeat(33), hex("c080"), hex("eda080"), hex("f4908080"), hex("e59f")]],
      [[1, 5, 4], [500n, 2147483648n]], [[1, 5, 5], [500n]],
      ...[1, 2, 3].map(id => [[2, id], ["", "x".repeat(65), "v/1", "版本"]] as [number[], string[]]),
      [[2, 4], [0n, 4294967296n]], [[2, 5], [new Uint8Array(31), new Uint8Array(33)]], [[3], [hex("0800")]],
    ];
    for (const [path, values] of cases) for (const value of values) fails(discovery(edit(pending, path, field(path.at(-1)!, value))));
    for (const reason of [0n, 3n, 2147483648n]) fails(discovery(edit(rejected, [5, 1], field(1, reason))));
    const invalidReceipts = [[1, [0n, 9223372036854775808n]], [2, [0n, 2n]], [3, [0n, 1n]],
      [4, [0n, 2n]], [5, [0n, 2n]], [6, [0n, 99n]]] as const;
    for (const [id, values] of invalidReceipts) {
      for (const value of values) fails(discovery(edit(success, [4, id], field(id, value))));
    }
    for (const extra of [field(4, parts(success).at(-1)!.data), field(5, field(1, 1n))]) fails(discovery(join(pending, extra)));
    fails(edit(discovery(), [2], join(field(1, new Uint8Array()), field(2, pending))));
    for (const path of [[1, 1, 1], [1, 2], [1, 5, 1], [1, 5, 3], [2, 1], [2, 2], [2, 3]]) {
      fails(discovery(edit(pending, path, field(path.at(-1)!, hex("eda080")))));
    }
    for (const malformed of [hex("208000"), hex("20ffffffffffffffffff01"), hex("9a0000"), hex("1a8000"), hex("1affffffff0f")]) {
      fails(edit(discovery(), [...recordPath, 1, 5, 4], malformed));
    }
  });
  it("accepts exact boundaries and valid Unicode without repair or precision loss", () => {
    for (const id of [1n, 9007199254740991n, 9007199254740992n, 9007199254740993n, 9223372036854775807n]) {
      const s = edit(edit(scope, [3], field(3, id)), [4], field(4, id));
      const r = edit(edit(pending, [1, 1], field(1, s)), [2, 4], field(4, 4294967295n));
      expect(decode(routes[3], discovery(r, s)).scope).toMatchObject({ playerId: id, accountId: id });
    }
    for (const name of [" ", "\uFEFF城", "\uFFFD", "e\u0301", "é", "😀".repeat(32)]) {
      const result = decode(routes[3], discovery(edit(pending, [1, 5, 3], field(3, name))));
      expect(result.head.kind === "command" && result.head.record.intent.proposal.name).toBe(name);
    }
    for (const path of [[1, 5, 4], [1, 5, 5]]) for (const value of [0n, 499n]) {
      expect(() => decode(routes[3], discovery(edit(pending, path, field(path.at(-1)!, value))))).not.toThrow();
    }
    expect(() => decode(routes[3], discovery(edit(pending, [1, 5, 2], field(2, field(2, otherId)))))).not.toThrow();
  });
  it("checks actual bytes and route, never defaults malformed input to empty or durable rejection", () => {
    for (const value of [null, {}, [], "", new ArrayBuffer(0), new Uint8Array(16385), new Uint8Array(), new Proxy(emptyDiscovery, {})]) fails(value);
    for (const route of [null, "toString", "world.v1.CreateCity", routes[0] + " "]) expect(() => decode(route, emptyDiscovery)).toThrow(TypeError);
    const spoofed = new Uint8Array(16385);
    Object.defineProperty(spoofed, "length", { value: 0 });
    fails(spoofed);
    expect(decode(routes[3], Buffer.from(emptyDiscovery)).kind).toBe("discovery");
  });
});
