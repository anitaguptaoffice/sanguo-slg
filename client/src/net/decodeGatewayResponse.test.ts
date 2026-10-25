import { describe, expect, it } from "vitest";
import protobuf from "protobufjs";
import { decodeGatewayResponse } from "./decodeGatewayResponse";
import { formatResourceAmount } from "./hudFormat";
const type = protobuf.parse(`syntax="proto3";
message Wallet { int64 food=1; uint64 gold=2; sint64 debt=3; fixed64 fixed=4; sfixed64 signed=5; }
message Response { enum State { EMPTY=0; READY=1; } Wallet wallet=1; repeated Wallet rows=2; map<string,Wallet> lookup=3; bytes data=4; State state=5; repeated int64 ids=6; bool active=7; string label=8; }`).root.lookupType("Response");
const binary = (value: object) => type.encode(type.fromObject(value)).finish();
describe("real protobuf gateway numeric boundary", () => {
  it("normalizes wallet Longs, defaults and nested arrays/maps without changing enum/bytes", () => {
    const bytes = binary({ wallet: { food: "8000", debt: "-25", fixed: "9007199254740991", signed: "-9007199254740991" }, rows: [{ food: "5000" }], lookup: { city: { food: "7000" } }, data: [1,2,255], state: "READY", ids: ["1001", "1002"] });
    const raw = type.decode(bytes) as unknown as { wallet: { food: number } };
    expect(Number.isFinite(raw.wallet.food)).toBe(false);
    expect(formatResourceAmount(raw.wallet.food)).toBe("0");
    const value = decodeGatewayResponse(type, bytes) as any;
    expect(value.wallet).toEqual({ food: 8000, gold: 0, debt: -25, fixed: Number.MAX_SAFE_INTEGER, signed: Number.MIN_SAFE_INTEGER });
    expect(formatResourceAmount(value.wallet.food)).toBe("8,000");
    expect(value.rows[0].food).toBe(5000); expect(value.lookup.city.food).toBe(7000);
    expect(value.ids).toEqual([1001,1002]); expect(value.state).toBe(1); expect([...value.data]).toEqual([1,2,255]);
    expect(value.active).toBe(false); expect(value.label).toBe("");
  });
  it.each(["9007199254740992", "-9007199254740992", "9223372036854775807"])("rejects unsafe signed %s without rounding", food => {
    expect(() => decodeGatewayResponse(type, binary({ rows: [{ food }] }))).toThrow("rows[0].food");
  });
  it("rejects uint64 maximum and keeps missing message/default collections", () => {
    expect(() => decodeGatewayResponse(type, binary({ wallet: { gold: "18446744073709551615" } }))).toThrow("wallet.gold");
    const empty = decodeGatewayResponse(type, binary({}));
    expect(empty.wallet).toBeNull(); expect(empty.rows).toEqual([]); expect(empty.lookup).toEqual({}); expect(empty.state).toBe(0);
  });
});
