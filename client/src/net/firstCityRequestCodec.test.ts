// @vitest-environment node
import protobuf from "protobufjs";
import { describe, expect, it, vi } from "vitest";
import { encodeFirstCityRequest as encode, decodeFirstCityRequest as decode } from "./firstCityRequestCodec";

const submit = "world.v2.SubmitFirstCity", resume = "world.v2.ContinueFirstCity";
const get = "world.v2.GetFirstCityResult", discovery = "world.v2.DiscoverFirstCityIntent";
const realm = "11111111-1111-4111-8111-111111111111", command = "22222222-2222-4222-8222-222222222222";
const previous = "33333333-3333-4333-8333-333333333333";
const scope = { realmId: realm, shard: 1, playerId: "9007199254740993", accountId: "9223372036854775807" };
const proposal = { commandId: command, predecessor: { kind: "empty" }, name: "城", x: 0, y: 499 };
const request = { expectedScope: scope, proposal };
const bytes = (hex: string) => new Uint8Array(Buffer.from(hex, "hex"));
const hex = (value: Uint8Array) => Buffer.from(value).toString("hex");
// Literal tags, lengths, UTF-8 and base-128 integers derived from the adopted proto,
// without protobufjs or the encoder. Scope is 59 bytes; proposals are 52/88 bytes.
const scopeHex = "0a2431313131313131312d313131312d343131312d383131312d313131313131313131313131" +
  "100118818080808080801020ffffffffffffffff7f";
const commandHex = "0a2432323232323232322d323232322d343232322d383232322d323232323232323232323232";
const rejectedHex = "122433333333333333332d333333332d343333332d383333332d333333333333333333333333";
const tail = "1a03e59f8e200028f303";
const proposalHex = commandHex + "12020a00" + tail;
const emptyFixture = "0a3b" + scopeHex + "1234" + proposalHex;
const rejectedFixture = "0a3b" + scopeHex + "1258" + commandHex + "1226" + rejectedHex + tail;
const getFixture = "0a3b" + scopeHex + "1224" + commandHex.slice(4);
const bad = (route: string, wire: string) => expect(() => decode(route, bytes(wire))).toThrow(new TypeError("Invalid first-city request"));
const wrap = (tag: string, part: string) => tag + hex(Uint8Array.of(part.length / 2)) + part;
const message = (s = scopeHex, p = proposalHex) => wrap("0a", s) + wrap("12", p);
const rejectInput = (route: unknown, input: unknown) => expect(() => encode(route, input)).toThrow("Invalid first-city request");

describe("complete strict first-city request payloads", () => {
  it.each([submit, resume])("uses independent complete literals for %s", route => {
    for (const [predecessor, literal] of [[{ kind: "empty" }, emptyFixture], [{ kind: "rejected", commandId: previous }, rejectedFixture]] as const) {
      const input = { expectedScope: scope, proposal: { ...proposal, predecessor } };
      expect(hex(encode(route, input))).toBe(literal);
      expect(decode(route, bytes(literal))).toEqual({ ...input, expectedScope: { ...scope, playerId: 9007199254740993n, accountId: 9223372036854775807n } });
    }
  });
  it("checks Get/Discovery literals, field order and explicit zero", () => {
    expect(hex(encode(get, { expectedScope: scope, commandId: command }))).toBe(getFixture);
    expect(decode(get, bytes(getFixture))).toMatchObject({ commandId: command });
    expect(decode(get, encode(get, { expectedScope: { ...scope, shard: 2147483647 }, commandId: command })))
      .toMatchObject({ expectedScope: { shard: 2147483647 } });
    expect(encode(discovery, {})).toEqual(new Uint8Array());
    expect(decode(discovery, bytes(""))).toEqual({});
    expect(decode(submit, bytes(wrap("12", proposalHex) + wrap("0a", scopeHex)))).toEqual(decode(submit, bytes(emptyFixture)));
    expect(decode(submit, bytes(message(scopeHex.slice(76) + scopeHex.slice(0, 76), tail + "12020a00" + commandHex)))).toEqual(decode(submit, bytes(emptyFixture)));
    expect(decode(submit, encode(submit, { ...request, proposal: { ...proposal, y: 0 } }))).toMatchObject({ proposal: { x: 0, y: 0 } });
  });
  it("preserves each identity boundary and rejects numeric/decimal aliases", () => {
    for (const field of ["playerId", "accountId"]) {
      for (const value of [1n, 9007199254740991n, 9007199254740992n, 9007199254740993n, 9223372036854775807n]) {
        const input = { expectedScope: { ...scope, [field]: value }, commandId: command };
        expect(decode(get, encode(get, input))).toMatchObject({ expectedScope: { [field]: value } });
        expect(encode(get, input)).toEqual(encode(get, { ...input, expectedScope: { ...input.expectedScope, [field]: String(value) } }));
        rejectInput(get, { ...input, expectedScope: { ...scope, [field]: Number(value) } });
      }
      for (const value of [0n, -1n, 9223372036854775808n, "0", "01", "+1", "1e0", " 1", "1\n", "9223372036854775808", NaN, null]) {
        rejectInput(get, { expectedScope: { ...scope, [field]: value }, commandId: command });
      }
    }
  });
  it("requires closed own data shapes without evaluating getters", () => {
    for (const route of [submit, resume, get, discovery]) {
      for (const input of [undefined, null, [], 1, "", { session: "secret" }, Object.create(request)]) rejectInput(route, input);
    }
    const spy = vi.fn(() => { throw new Error("private account"); });
    for (const input of [request, scope, proposal, proposal.predecessor]) {
      const outer = (value: unknown) => {
        if (input === request) return value;
        if (input === scope) return { ...request, expectedScope: value };
        if (input === proposal) return { ...request, proposal: value };
        return { ...request, proposal: { ...proposal, predecessor: value } };
      };
      for (const key of Object.keys(input)) {
        const changed = { ...input } as Record<string, unknown>;
        delete changed[key];
        rejectInput(submit, outer(changed));
        rejectInput(submit, outer(Object.defineProperty({ ...input }, key, { get: spy })));
      }
      rejectInput(submit, outer({ ...input, authority: true }));
    }
    expect(spy).not.toHaveBeenCalled();
    for (const route of ["world.v1.CreateCity", "world.v2.SubmitFirstCityRequest", "toString", "__proto__", 1, null]) {
      rejectInput(route, request);
      expect(() => decode(route, bytes(emptyFixture))).toThrow("Invalid first-city request");
    }
  });
  it("rejects invalid UUIDs, predecessors, names, coordinates and shard", () => {
    for (const commandId of ["", previous.toUpperCase().replace("3333", "ABCD"), previous.replace("-4333-", "-1333-"), previous + "\n", null]) {
      rejectInput(get, { expectedScope: scope, commandId });
    }
    for (const predecessor of [{}, { kind: "rejected", commandId: command }, { kind: "empty", commandId: previous }, { kind: "rejected" }]) {
      rejectInput(submit, { ...request, proposal: { ...proposal, predecessor } });
    }
    for (const name of ["", "a".repeat(33), "😀".repeat(33), "\0", "\ud800", "\udfff", 1]) rejectInput(resume, { ...request, proposal: { ...proposal, name } });
    for (const field of ["x", "y"]) for (const value of [-1, 500, 0.5, "0", null, undefined, Infinity]) {
      rejectInput(submit, { ...request, proposal: { ...proposal, [field]: value } });
    }
    for (const shard of [0, 2147483648, 1.5, "1"]) rejectInput(get, { expectedScope: { ...scope, shard }, commandId: command });
    for (const name of ["😀".repeat(32), "e\u0301", "é", " 城 ", "\ufffd", "\ufeff城"]) {
      expect(decode(submit, encode(submit, { ...request, proposal: { ...proposal, name } }))).toMatchObject({ proposal: { name } });
    }
  });
  it("rejects duplicates, unknowns and missing fields at every nested layer", () => {
    for (const extra of ["1800", "0a00", wrap("0a", scopeHex), wrap("12", proposalHex)]) bad(submit, emptyFixture + extra);
    for (const extra of ["2800", "1001", "1002", scopeHex.slice(0, 76), "1801", "2001"]) bad(submit, message(scopeHex + extra));
    for (const extra of ["3000", commandHex, "12020a00", "1a03e59f8e", "2000", "2001", "28f303"]) bad(submit, message(scopeHex, proposalHex + extra));
    for (const predecessor of ["", "1800", "0a000a00", rejectedHex + rejectedHex, "0a00" + rejectedHex, "0a020800"]) {
      bad(submit, message(scopeHex, commandHex + wrap("12", predecessor) + tail));
    }
    for (const p of [proposalHex.slice(76), commandHex + tail, commandHex + "12020a00200028f303", commandHex + "12020a001a03e59f8e28f303", proposalHex.slice(0, -6)]) {
      bad(submit, message(scopeHex, p));
    }
    for (const s of [scopeHex.slice(76), scopeHex.replace("1001", ""), scopeHex.slice(0, 80) + scopeHex.slice(98), scopeHex.slice(0, 98)]) bad(submit, message(s));
    for (const wire of ["", wrap("0a", scopeHex), "1224" + commandHex.slice(4), getFixture + "1224" + commandHex.slice(4), getFixture + "1800"]) bad(get, wire);
    bad(discovery, "0800");
  });
  it("rejects malformed raw grammar before decoding can repair or narrow", () => {
    for (const extra of ["00", "0b0c", "09", "0d", "0f", "80", "8a00", "ffffffff1f00", "808080808000", "8080808080808080808000"]) bad(submit, emptyFixture + extra);
    for (const length of ["bb00", "8080808010", "ffffffff0f", "80"]) bad(submit, "0a" + length + scopeHex);
    for (const value of ["8100", "8080808010", "8080808008", "ffffffffffffffffff01", "8080808080808080808000"]) {
      bad(submit, message(scopeHex.replace("1001", "10" + value)));
    }
    for (const value of ["00", "8100", "80808080808080808001", "ffffffffffffffffff02"]) bad(submit, message(scopeHex.replace("188180808080808010", "18" + value)));
    for (const value of ["8000", "8080808010", "f403"]) bad(submit, message(scopeHex, proposalHex.replace("2000", "20" + value)));
    for (const utf8 of ["80", "c080", "eda080", "f4908080", "e59f", "ff"]) {
      bad(submit, message(scopeHex, commandHex + "12020a00" + wrap("1a", utf8) + "200028f303"));
      bad(get, wrap("0a", scopeHex.replace(scopeHex.slice(0, 76), wrap("0a", utf8))) + "1224" + commandHex.slice(4));
      bad(get, wrap("0a", scopeHex) + wrap("12", utf8));
      bad(submit, message(scopeHex, commandHex + wrap("12", wrap("12", utf8)) + tail));
    }
    for (let end = 0; end < emptyFixture.length / 2; end++) bad(resume, emptyFixture.slice(0, end * 2));
    const oversized = new Uint8Array(2049);
    Object.defineProperty(oversized, "length", { value: 0 });
    for (const value of [oversized, [], null, new DataView(new ArrayBuffer(0)), new Proxy(bytes(emptyFixture), {})]) {
      expect(() => decode(discovery, value)).toThrow("Invalid first-city request");
    }
  });
  it("copies and freezes snapshots, isolates bytes, and fails without strict backends", () => {
    const source = bytes(rejectedFixture);
    const result = decode(submit, source) as { expectedScope: object; proposal: { predecessor: object } };
    source.fill(0);
    for (const value of [result, result.expectedScope, result.proposal, result.proposal.predecessor, decode(discovery, bytes(""))]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    expect(hex(encode(submit, result))).toBe(rejectedFixture);
    const first = encode(submit, request);
    first.fill(0);
    expect(hex(encode(submit, request))).toBe(emptyFixture);
    const Long = protobuf.util.Long;
    try {
      protobuf.util.Long = null as never;
      rejectInput(submit, request);
      expect(() => decode(get, bytes(getFixture))).toThrow("Invalid first-city request");
    } finally { protobuf.util.Long = Long; }
    const mutable = { expectedScope: { ...scope }, proposal: { ...proposal, predecessor: { kind: "empty" } } };
    const saved = encode(submit, mutable);
    mutable.proposal.name = "changed";
    mutable.expectedScope.accountId = "1";
    expect(hex(saved)).toBe(emptyFixture);
    vi.stubGlobal("TextDecoder", undefined);
    try { rejectInput(discovery, {}); expect(() => decode(discovery, bytes(""))).toThrow("Invalid first-city request"); }
    finally { vi.unstubAllGlobals(); }
    vi.stubGlobal("TextDecoder", class { fatal = false; ignoreBOM = true; });
    try { rejectInput(discovery, {}); } finally { vi.unstubAllGlobals(); }
  });
});
