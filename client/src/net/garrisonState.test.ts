import { describe, expect, it } from "vitest";
import { getProtoRoot } from "./loadProto";
import { decodeGatewayResponse } from "./decodeGatewayResponse";
import { garrisonPatch, parseGarrison, readyGarrison } from "./garrisonState";
import type { MainCitySession } from "./bootstrapSession";

const type = getProtoRoot().lookupType("sanguo.domestic.v1.GetCityStateResponse");
const decode = (value: object) => decodeGatewayResponse(type, type.encode(type.fromObject(value)).finish());
const one = [{ unit_cfg_id: 1, count: 1 }];
describe("ready garrison contract through production binary decoder", () => {
  it("distinguishes absent/null from present empty without losing field3 or Long normalization", () => {
    const absent = decode({ wallet: { food: "8000" }, production_rates: { food: "40" } });
    expect(absent.garrison).toBeNull();
    expect(absent.wallet).toMatchObject({ food: 8000 });
    expect(absent.production_rates).toMatchObject({ food: 40 });
    expect(parseGarrison(absent.garrison)).toBeNull();
    expect(parseGarrison(decode({ garrison: {} }).garrison)).toEqual([]);
    expect(type.fields.garrison.id).toBe(4);
  });
  it("replaces the full ready set, removes missing IDs, and accepts authoritative zero", () => {
    const previous = { cityTroops: [...one, { unit_cfg_id: 2, count: 7 }], garrisonStatus: "ready" as const };
    const next = garrisonPatch(previous, decode({ garrison: { troops: one } }).garrison);
    expect(next).toEqual({ cityTroops: one, garrisonStatus: "ready" });
    expect(garrisonPatch(next, {})).toEqual({ cityTroops: [], garrisonStatus: "ready" });
  });
  it.each([undefined, null])("retains only stale cache on %s, never enables march or invents troops", (missing) => {
    const next = garrisonPatch({ cityTroops: one, garrisonStatus: "ready" }, missing);
    expect(next.cityTroops).toBe(one);
    expect(next.garrisonStatus).toBe("stale");
    expect(readyGarrison(next as MainCitySession)).toEqual([]);
    expect(garrisonPatch({ cityTroops: [], garrisonStatus: "unknown" }, missing).garrisonStatus).toBe("unknown");
  });
  it.each([false, [], { troops: null }, { troops: {} }, { troops: [null] },
    { troops: [...one, ...one] }, { troops: [{ unit_cfg_id: 2, count: 1 }, ...one] },
    { troops: [{ unit_cfg_id: 0, count: 1 }] }, { troops: [{ unit_cfg_id: 1, count: 0 }] },
    { troops: [{ unit_cfg_id: 1, count: -1 }] }, { troops: [{ unit_cfg_id: 1, count: 1.5 }] },
    { troops: [{ unit_cfg_id: 1, count: 2147483648 }] }])("rejects malformed snapshot %# atomically", value => {
    expect(() => parseGarrison(value)).toThrow();
    expect(garrisonPatch({ cityTroops: one, garrisonStatus: "ready" }, value)).toEqual({ cityTroops: one, garrisonStatus: "stale" });
  });
});

it("rejects unsafe int64 from actual Go marshal instead of rounding before garrison apply", () => {
  // internal/api/pb/.../TestGarrisonWireCompatibility at 721d02c (food=2^53+1).
  const hex = "0a1508818080808080801010ca0118af0220940328f90312160a086261727261636b7310e907180120bbbbd5ca97341a08080b10161821202c22120a0508e90710010a0908ea0710ffffffff07";
  expect(() => decodeGatewayResponse(type, Uint8Array.from(hex.match(/../g)!, v => parseInt(v, 16)))).toThrow();
});

it("decodes actual Go marshal presence and ready rows through production H5", () => {
  // Deterministic proto.Marshal, domesticv1 at 721d02c; food8000 safe companion fixture.
  const prefix = "0a0f08c03e10ca0118af0220940328f90312160a086261727261636b7310e907180120bbbbd5ca97341a08080b10161821202c";
  const read = (suffix: string) => decodeGatewayResponse(type,
    Uint8Array.from((prefix + suffix).match(/../g)!, v => parseInt(v, 16)));
  expect(read("").garrison).toBeNull();
  expect(parseGarrison(read("2200").garrison)).toEqual([]);
  const ready = read("22120a0508e90710010a0908ea0710ffffffff07");
  expect(parseGarrison(ready.garrison)).toEqual([{ unit_cfg_id: 1001, count: 1 }, { unit_cfg_id: 1002, count: 2147483647 }]);
  expect(ready.wallet).toMatchObject({ food: 8000 });
  expect(ready.production_rates).toMatchObject({ food: 11, wood: 22 });
  expect(ready.buildings).toMatchObject([{ upgrade_finish_at_ms: 1793037000123 }]);
});
