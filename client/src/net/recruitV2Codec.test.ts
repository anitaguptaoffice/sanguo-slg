import { describe, expect, it } from "vitest";
import protobuf from "protobufjs";
import { getProtoRoot } from "./loadProto";
import { decodeGatewayResponse } from "./decodeGatewayResponse";
import { decodeRecruitV2Response, encodeRecruitV2Request, type RecruitV2Intent } from "./recruitV2Codec";

const schema = (name: string) => getProtoRoot().lookupType(`sanguo.military.v1.${name}`);
const request = () => ({ city_id: "9223372036854775807", unit_cfg_id: 1, count: 2,
  command_id: Uint8Array.from({ length: 16 }, (_, i) => i), intent_version: 1 });
const acceptance = () => ({ queue_id: "9007199254740991", city_id: "9223372036854775807",
  unit_cfg_id: 4, count: 2147483647, food_paid: "9223372036854775807",
  wood_paid: "9007199254740993", iron_paid: "0", stone_paid: "1", duration_sec: "1",
  initial_status: 0, accepted_at_ms: "-62135596800000", initial_start_at_ms: "0",
  initial_finish_at_ms: "1000", catalog_version: new TextEncoder().encode(`recruit-v1:${"a".repeat(64)}`),
  rule_digest: new Uint8Array(32).fill(255) });
const response = (overrides = {}) => {
  const t = schema("RecruitTroopV2Response");
  return t.encode(t.fromObject({ acceptance: { ...acceptance(), ...overrides } })).finish();
};
const readRequest = (intent: RecruitV2Intent) => {
  const t = schema("RecruitTroopV2Request");
  return t.toObject(t.decode(encodeRecruitV2Request(intent)), { longs: String, defaults: true });
};

describe("dormant Recruit V2 canonical codec", () => {
  it.each([0, 1, 2, 32768, 65537, 4294967295])("preserves uint32 version %s for server comparison", version => {
    expect(readRequest({ ...request(), intent_version: version }).intent_version).toBe(version);
  });
  it.each(["-9223372036854775808", "-9007199254740993", "0", "9007199254740993", "9223372036854775807"])("roundtrips signed city %s", city => {
    expect(readRequest({ ...request(), city_id: BigInt(city) }).city_id).toBe(city);
  });
  it.each([-2147483648, 0, 2147483647])("preserves historical int32 intent %s", value => {
    const got = readRequest({ ...request(), unit_cfg_id: value, count: value });
    expect([got.unit_cfg_id, got.count]).toEqual([value, value]);
  });
  it("uses canonical field tags and detached command bytes", () => {
    const input = { ...request(), city_id: "1", unit_cfg_id: 2, count: 3 };
    const encoded = encodeRecruitV2Request(input);
    expect(Array.from(encoded)).toEqual([8, 1, 16, 2, 24, 3, 34, 16, ...input.command_id, 40, 1]);
    input.command_id.fill(0);
    expect(schema("RecruitTroopV2Request").decode(encoded).toJSON().command_id).not.toBe("");
    expect(Array.from(encoded).slice(8, 24)).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });
  it.each([
    { city_id: "9223372036854775808" }, { city_id: "-9223372036854775809" },
    { city_id: "01" }, { city_id: "1e3" }, { city_id: "-0" }, { city_id: 1 },
    { unit_cfg_id: 2147483648 }, { count: -2147483649 }, { count: 1.5 },
    { intent_version: -1 }, { intent_version: 4294967296 }, { intent_version: NaN },
    { command_id: new Uint8Array(16) }, { command_id: new Uint8Array(15).fill(1) },
    { command_id: new Uint8Array(17).fill(1) }, { command_id: [1] },
  ])("rejects unrepresentable request %j", patch => {
    expect(() => encodeRecruitV2Request({ ...request(), ...patch } as RecruitV2Intent)).toThrow();
  });
  it("roundtrips all 15 immutable acceptance fields without numeric narrowing", () => {
    const expected = acceptance(), got = decodeRecruitV2Response(response());
    expect(got).toEqual({ ...expected, catalog_version: Array.from(expected.catalog_version), rule_digest: Array.from(expected.rule_digest) });
    const t = schema("RecruitTroopV2Response");
    expect(t.encode(t.fromObject({ acceptance: got })).finish()).toEqual(response());
    expect(Object.keys(got)).toHaveLength(15);
  });
  it.each(["0", "9007199254740991", "9007199254740992", "9223372036854775807"])("preserves all paid fields at %s", paid => {
    const got = decodeRecruitV2Response(response({ food_paid: paid, wood_paid: paid, iron_paid: paid, stone_paid: paid }));
    expect([got.food_paid, got.wood_paid, got.iron_paid, got.stone_paid]).toEqual([paid, paid, paid, paid]);
  });
  it("accepts omitted proto3 zeros and valid active/max-time plans", () => {
    const active = response({ initial_status: 1, accepted_at_ms: "253402300798999", initial_start_at_ms: "253402300798999", initial_finish_at_ms: "253402300799999" });
    expect(decodeRecruitV2Response(active).initial_status).toBe(1);
    const a: Record<string, unknown> = { ...acceptance(), accepted_at_ms: "0" };
    delete a.initial_status; delete a.iron_paid; delete a.initial_start_at_ms; delete a.accepted_at_ms;
    const t = schema("RecruitTroopV2Response");
    expect(decodeRecruitV2Response(t.encode(t.fromObject({ acceptance: a })).finish())).toMatchObject({ initial_status: 0, iron_paid: "0", accepted_at_ms: "0" });
    expect(decodeRecruitV2Response(response({ duration_sec: "9223372036", initial_finish_at_ms: "9223372036000" })).duration_sec).toBe("9223372036");
  });
  it.each([
    { queue_id: "0" }, { queue_id: "9007199254740992" }, { city_id: "-1" },
    { unit_cfg_id: 0 }, { unit_cfg_id: 5 }, { count: 0 }, { food_paid: "-1" }, { wood_paid: "-1" },
    { iron_paid: "-1" }, { stone_paid: "-1" }, { duration_sec: "0" }, { duration_sec: "9223372037" },
    { initial_status: -1 }, { initial_status: 2 }, { accepted_at_ms: "-62135596800001" },
    { initial_start_at_ms: "-62135596800001" }, { initial_finish_at_ms: "253402300800000" },
    { accepted_at_ms: "1" }, { initial_status: 1 }, { initial_finish_at_ms: "1001" },
    { catalog_version: new TextEncoder().encode(`recruit-v1:${"A".repeat(64)}`) },
    { catalog_version: new Uint8Array(75).fill(255) }, { catalog_version: new Uint8Array(76) },
    { rule_digest: new Uint8Array(31) }, { rule_digest: new Uint8Array(33) },
  ])("rejects malformed acceptance %j", patch => {
    expect(() => decodeRecruitV2Response(response(patch))).toThrow();
  });
  it.each([new Uint8Array(), Uint8Array.of(10, 0), Uint8Array.of(10, 127, 1), Uint8Array.of(8, 1), Uint8Array.of(0), Uint8Array.of(10, 1, 128)])("rejects missing/truncated/wrong-wire acceptance %#", bytes => {
    expect(() => decodeRecruitV2Response(bytes)).toThrow();
  });
  it("rejects oversized varints before protobufjs truncates them", () => {
    for (const field of [1, 3, 10]) {
      const invalidValue = [field * 8, ...new Array(9).fill(128), 2];
      const writer = protobuf.Writer.create().uint32(10).bytes(Uint8Array.from(invalidValue));
      expect(() => decodeRecruitV2Response(writer.finish())).toThrow();
    }
    // Status 2^32 otherwise aliases legal status 0 in protobufjs int32 decoding.
    const body = schema("RecruitAcceptance").encode(schema("RecruitAcceptance").fromObject(acceptance())).finish();
    const malformed = Uint8Array.from([...body, 80, 128, 128, 128, 128, 16]);
    expect(() => decodeRecruitV2Response(protobuf.Writer.create().uint32(10).bytes(malformed).finish())).toThrow();
  });
  it("validates unknown fields without narrowing while preserving compatible extensions", () => {
    const valid = response();
    for (const suffix of [[16, 1], [17, ...new Array(8).fill(0)], [18, 1, 255], [21, 0, 0, 0, 0], [19, 27, 28, 20]]) {
      expect(decodeRecruitV2Response(Uint8Array.from([...valid, ...suffix]))).toEqual(decodeRecruitV2Response(valid));
    }
    for (const suffix of [[18, 128, 128, 128, 128, 16], [16, ...new Array(10).fill(128), 0],
      [17, 0], [21, 0], [19], [19, 28], [20], [22]]) {
      expect(() => decodeRecruitV2Response(Uint8Array.from([...valid, ...suffix]))).toThrow();
    }
  });
  it("returns frozen independent bytes and record", () => {
    const bytes = response(), got = decodeRecruitV2Response(bytes);
    bytes.fill(0);
    expect(got.rule_digest).toEqual(new Array(32).fill(255));
    expect(Object.isFrozen(got)).toBe(true);
    expect(Object.isFrozen(got.catalog_version)).toBe(true);
    expect(Object.isFrozen(got.rule_digest)).toBe(true);
    expect(() => { (got.rule_digest as number[])[0] = 1; }).toThrow();
    expect(() => { (got as { food_paid: string }).food_paid = "0"; }).toThrow();
  });
  it("leaves the legacy safe-number decoder unchanged", () => {
    const t = schema("RecruitTroopResponse");
    const encode = (queue_id: string) => t.encode(t.fromObject({ queue_id })).finish();
    expect(decodeGatewayResponse(t, encode("9007199254740991")).queue_id).toBe(9007199254740991);
    expect(() => decodeGatewayResponse(t, encode("9007199254740992"))).toThrow(/safe range/);
  });
});
