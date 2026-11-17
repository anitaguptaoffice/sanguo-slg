// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createFirstCityIntent, validateFirstCityScope, validateFirstCityUuid } from "./firstCityCanonical";

const realm = "11111111-1111-4111-8111-111111111111";
const command = "22222222-2222-4222-8222-222222222222";
const previous = "33333333-3333-4333-8333-333333333333";
const rejected = { kind: "rejected", commandId: previous };
const scope = (): Record<string, unknown> => ({
  realmId: realm, shard: 1, playerId: "9007199254740993", accountId: "9223372036854775807",
});
const proposal = (): Record<string, unknown> => ({
  commandId: command, predecessor: { kind: "empty" }, name: "城", x: 0, y: 499,
});
const make = (s = {}, p = {}) => createFirstCityIntent({ ...scope(), ...s }, { ...proposal(), ...p });
const reject = (s: unknown, p: unknown) => {
  expect(() => createFirstCityIntent(s, p)).toThrow(new TypeError("Invalid first-city intent"));
};
// Independently reconstructed from FIRST-CITY-WIRE.md §4, not an encoder oracle.
const emptyHex = "5347464300010010776f726c642e66697273745f6369747900000002" +
  "111111111111411181111111111111110000000100200000000000017fffffffffffffff" +
  "22222222222242228222222222222222000003e59f8e000001f3";
const rejectedHex = "5347464300010010776f726c642e66697273745f6369747900000002" +
  "111111111111411181111111111111110000000100200000000000017fffffffffffffff" +
  "2222222222224222822222222222222201333333333333433383333333333333330003e59f8e000001f3";
const bytes = (hex: string) => new Uint8Array(Buffer.from(hex, "hex"));

describe("first-city immutable C1 intent", () => {
  it.each([
    [{ kind: "empty" }, emptyHex, 90, "6c7a376e196f51fb6a36497597e0f8af759aabb03a3f84a5938e40210e9bb23f"],
    [rejected, rejectedHex, 106, "eeb911e086843f3329083b5d473b40d5d2ea62ae97017afacf40850aec35117a"],
  ])("matches complete literal and digest for %j", (predecessor, hex, length, digest) => {
    const intent = make({}, { predecessor });
    expect(intent.encode()).toEqual(bytes(hex as string));
    expect(intent.encode()).toHaveLength(length as number);
    expect(createHash("sha256").update(intent.encode()).digest("hex")).toBe(digest);
    expect(intent.matches(make({}, { predecessor }).encode())).toBe(true);
    expect(make({ playerId: 9007199254740993n, accountId: 9223372036854775807n }, { predecessor }).encode()).toEqual(intent.encode());
  });

  it.each(["playerId", "accountId"])("preserves each signed64 boundary in %s", field => {
    for (const value of [1n, 9007199254740991n, 9007199254740992n, 9007199254740993n, 9223372036854775807n]) {
      const encoded = make({ [field]: value.toString() }).encode();
      expect(encoded).toEqual(make({ [field]: value }).encode());
      const offset = field === "playerId" ? 48 : 56;
      expect(new DataView(encoded.buffer).getBigUint64(offset, false)).toBe(value);
      expect(make({ [field]: value }).scope[field as "playerId" | "accountId"]).toBe(value);
    }
  });
  it.each(["playerId", "accountId"])("rejects malformed identities independently: %s", field => {
    for (const value of [1, Number.MAX_SAFE_INTEGER, 9007199254740992, NaN, Infinity, -1, 0,
      "", "0", "-1", "+1", "01", " 1", "1 ", "1\n", "1.0", "1e0", "0x1", "１",
      "9223372036854775808", "10000000000000000000", 0n, -1n, 9223372036854775808n,
      undefined, null, true, {}, [], new String("1"), new Number(1), Object(1n), Symbol("1"), () => 1]) {
      reject({ ...scope(), [field]: value }, proposal());
    }
  });

  it("requires own complete data fields and rejects missing/null/wrong wrappers", () => {
    for (const value of [undefined, null, false, 1, 1n, "", [], () => ({}), new Date()]) {
      reject(value, proposal());
      reject(scope(), value);
    }
    for (const side of ["scope", "proposal"]) {
      const original = side === "scope" ? scope() : proposal();
      for (const key of Object.keys(original)) {
        const missing = { ...original };
        delete missing[key];
        for (const invalid of [missing, { ...original, [key]: undefined }, { ...original, [key]: null }, Object.create(original)]) {
          reject(side === "scope" ? invalid : scope(), side === "proposal" ? invalid : proposal());
        }
      }
    }
    reject({ ...scope(), extra: true }, proposal());
    reject(scope(), { ...proposal(), extra: true });
    reject(scope(), Object.defineProperty(proposal(), "name", { get: () => { throw new Error("private payload"); } }));
  });
  it("requires exactly one explicit predecessor arm with a different command", () => {
    for (const predecessor of [undefined, null, {}, [], 0, "empty", { kind: "unknown" }, { kind: "rejected" },
      { kind: "empty", commandId: previous }, { kind: "empty", empty: {} }, { commandId: previous },
      { kind: "rejected", commandId: previous, empty: {} }, { kind: "rejected", commandId: command }]) {
      reject(scope(), { ...proposal(), predecessor });
    }
    expect(make().proposal.predecessor).toEqual({ kind: "empty" });
    expect(make({}, { predecessor: rejected }).proposal.predecessor).toEqual(rejected);
  });

  it("checks UUID syntax for realm, command and rejected predecessor without aliases", () => {
    const inputs = [null, 1, {}, "", command.toUpperCase().replace("2222", "ABCD"), ` ${command}`, `${command}\n`,
      `{${command}}`, command.replaceAll("-", ""), command.replace("-4222-", "-1222-"),
      command.replace("-8222-", "-7222-"), "00000000-0000-0000-0000-000000000000", command.replace("2", "g")];
    for (const id of inputs) {
      reject({ ...scope(), realmId: id }, proposal());
      reject(scope(), { ...proposal(), commandId: id });
      reject(scope(), { ...proposal(), predecessor: { kind: "rejected", commandId: id } });
    }
    for (const variant of ["8", "9", "a", "b"]) {
      const id = previous.replace("-8333-", `-${variant}333-`);
      expect(make({ realmId: id }).scope.realmId).toBe(id);
      expect(make({}, { commandId: id }).proposal.commandId).toBe(id);
      expect(make({}, { predecessor: { kind: "rejected", commandId: id } }).proposal.predecessor).toEqual({ kind: "rejected", commandId: id });
    }
  });
  it("bounds numeric shard/coordinates and preserves explicit zeros", () => {
    for (const field of ["shard", "x", "y"]) {
      const maximum = field === "shard" ? 2147483647 : 499;
      for (const value of [-1, maximum + 1, 0.5, NaN, Infinity, -Infinity, "1", 1n, true, {}, [], undefined, null]) {
        reject(field === "shard" ? { ...scope(), shard: value } : scope(), field === "shard" ? proposal() : { ...proposal(), [field]: value });
      }
    }
    reject({ ...scope(), shard: 0 }, proposal());
    expect(make({ shard: 2147483647 }, { x: 499, y: 0 }).proposal).toMatchObject({ x: 499, y: 0 });
    expect(make({}, { x: 0, y: 0 }).encode().slice(-4)).toEqual(new Uint8Array(4));
  });
  it("preserves scalar names exactly and rejects surrogates before encoding", () => {
    for (const name of ["a".repeat(32), "😀".repeat(32), "e\u0301", "é", " ", " 城 ", "\ufffd"]) {
      expect(make({}, { name }).proposal.name).toBe(name);
    }
    const maximum = make({}, { name: "😀".repeat(32), predecessor: rejected }).encode();
    expect(maximum).toHaveLength(231);
    expect(new DataView(maximum.buffer).getUint16(97, false)).toBe(128);
    expect(make({}, { name: "e\u0301" }).matches(make({}, { name: "é" }).encode())).toBe(false);
    for (const name of ["", "a".repeat(33), "😀".repeat(33), "\0", "a\0b", "\ud800", "\udfff", "a\ud800b", "\ud800\ud800", "\udc00\ud800", 1, true, {}, []]) {
      reject(scope(), { ...proposal(), name });
    }
    const encodeSpy = vi.spyOn(TextEncoder.prototype, "encode");
    try {
      for (const name of ["\ud800", "\udc00", "x\ud800y"]) reject(scope(), { ...proposal(), name });
      expect(encodeSpy).not.toHaveBeenCalled();
    } finally { encodeSpy.mockRestore(); }
  });

  it("distinguishes every independent scope/proposal field", () => {
    const original = make();
    for (const s of [{ realmId: previous }, { shard: 2 }, { playerId: "1" }, { accountId: "1" }]) {
      expect(original.matches(make(s).encode())).toBe(false);
    }
    for (const p of [{ commandId: previous }, { predecessor: rejected }, { name: "城 " }, { x: 1 }, { y: 498 }]) {
      expect(original.matches(make({}, p).encode())).toBe(false);
    }
    expect(make({}, { predecessor: rejected }).matches(make({}, { predecessor: { kind: "rejected", commandId: realm } }).encode())).toBe(false);
  });
  it.each([{ kind: "empty" }, rejected])("rejects every byte change, prefix and extension: %j", predecessor => {
    const intent = make({}, { predecessor });
    const original = intent.encode();
    for (let i = 0; i < original.length; i++) {
      const changed = original.slice();
      changed[i] ^= 1;
      expect(intent.matches(changed)).toBe(false);
      expect(intent.matches(original.slice(0, i))).toBe(false);
    }
    expect(intent.matches(Uint8Array.from([...original, 0]))).toBe(false);
    const disguisedExtension = Uint8Array.from([...original, 0]);
    Object.defineProperty(disguisedExtension, "length", { value: original.length });
    expect(intent.matches(disguisedExtension)).toBe(false);
    expect(intent.matches(new Proxy(original, { get: (target, key) => Reflect.get(target, key, target) }))).toBe(false);
    for (const value of [null, undefined, true, 1, "", [...original], original.buffer, new DataView(original.buffer), new Int8Array(original), new Proxy(original, {})]) {
      expect(intent.matches(value)).toBe(false);
    }
  });
  it("copies inputs, freezes all snapshots and never exposes retained bytes", () => {
    const s = scope();
    const p = { ...proposal(), predecessor: { ...rejected } };
    const intent = createFirstCityIntent(s, p);
    const original = bytes(rejectedHex);
    s.realmId = previous;
    p.name = "changed";
    p.predecessor.commandId = realm;
    intent.encode().fill(0);
    expect(intent.encode()).not.toBe(intent.encode());
    for (const snapshot of [intent, intent.scope, intent.proposal, intent.proposal.predecessor]) {
      expect(Object.isFrozen(snapshot)).toBe(true);
      for (const key of Object.keys(snapshot)) expect(Reflect.set(snapshot, key, null)).toBe(false);
    }
    expect(intent.encode()).toEqual(original);
    expect(intent.matches(original)).toBe(true);
    expect(intent.proposal.predecessor).toEqual(rejected);
  });
});

it("reuses strict scope and UUID entries without a fabricated proposal", () => {
  const input = scope();
  const snapshot = validateFirstCityScope(input);
  input.playerId = "1";
  expect(snapshot).toEqual(make().scope);
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(validateFirstCityUuid(command)).toBe(command);
  for (const value of [null, 1, {}, command + "\n", command.replace("-4222-", "-1222-")]) {
    expect(() => validateFirstCityUuid(value)).toThrow("Invalid first-city intent");
  }
  for (const value of [null, Object.create(scope()), { ...scope(), playerId: 1 }, { ...scope(), extra: 1 },
    Object.defineProperty(scope(), "shard", { get: () => { throw new Error("private source"); } })]) {
    expect(() => validateFirstCityScope(value)).toThrow(new TypeError("Invalid first-city intent"));
  }
});
