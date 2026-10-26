// Contract only: no API/client implementation or server is executed.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const pb = require(process.env.PROTOBUFJS_PATH || "../../../client/node_modules/protobufjs");
const protoDir = path.resolve(__dirname, "..");
function load(militaryPath) {
  const root = new pb.Root();
  for (const file of [path.join(protoDir, "sanguo/common/v1/types.proto"), militaryPath]) {
    pb.parse(fs.readFileSync(file, "utf8"), root, { keepCase: true });
  }
  return root.resolveAll();
}
const legacy = load(path.join(__dirname, "fixtures/march-returned-legacy.proto.txt"));
const current = load(path.join(protoDir, "sanguo/military/v1/military.proto"));
const pkg = "sanguo.military.v1.";
const oldEnum = legacy.lookupEnum(pkg + "MarchPhase").values;
const newEnum = current.lookupEnum(pkg + "MarchPhase").values;
assert.deepEqual(Object.values(oldEnum), [0, 1, 2, 3, 4]);
assert.deepEqual(newEnum, { ...oldEnum, MARCH_PHASE_RETURNED: 5 });
function signature(type) {
  return type.fieldsArray.map(f => [f.name, f.id, f.type, !!f.repeated, !!f.map]);
}
for (const name of ["MarchSummary", "ListMarchesRequest", "ListMarchesResponse"]) {
  assert.deepEqual(signature(current.lookupType(pkg + name)), signature(legacy.lookupType(pkg + name)));
}
const oldRow = legacy.lookupType(pkg + "MarchSummary");
const newRow = current.lookupType(pkg + "MarchSummary");
assert.equal(newRow.fieldsArray.length, 13);
assert.deepEqual([...newRow.encode({ phase: 5 }).finish()], [0x48, 0x05]);
assert.equal(oldRow.decode(Uint8Array.of(0x48, 0x05)).phase, 5);
assert.match(oldRow.verify({ phase: 5 }), /enum value expected/);
assert.equal(newRow.verify({ phase: 5 }), null);
const plain = (type, bytes) => type.toObject(type.decode(bytes), {
  longs: String, defaults: true, arrays: true, objects: true,
});
const sample = {
  march_id: 21, army_id: 31, origin_city_id: 41,
  from_x: 60, from_y: 60, to_x: 5, to_y: 5, purpose: 1,
  depart_at_ms: 1792984200000, arrive_at_ms: 1792988160000,
  return_finish_at_ms: 0, troops: [{ unit_cfg_id: 1, count: 19 }],
};
for (const phase of [0, 1, 2, 3, 4, 5, 127]) {
  const row = { ...sample, phase, return_finish_at_ms: phase === 4 ? 1792992120000 : 0 };
  const bytes = newRow.encode(row).finish();
  assert.deepEqual(plain(oldRow, bytes), plain(newRow, bytes));
  assert.deepEqual([...oldRow.encode(oldRow.decode(bytes)).finish()], [...bytes]);
  if (phase <= 4) {
    assert.deepEqual([...oldRow.encode(row).finish()], [...bytes]);
    assert.equal(newRow.decode(oldRow.encode(row).finish()).phase, phase);
  }
}
const newList = current.lookupType(pkg + "ListMarchesResponse");
const oldList = legacy.lookupType(pkg + "ListMarchesResponse");
const bytes = newList.encode({
  marches: [{ ...sample, phase: 1 }, { ...sample, march_id: 22, phase: 5 }], total: 23,
}).finish();
assert.deepEqual(plain(oldList, bytes), plain(newList, bytes));
assert.equal(plain(oldList, bytes).total, 23);
assert.deepEqual(plain(oldList, bytes).marches.map(m => m.phase), [1, 5]);
console.log("PASS: unchanged fields/0–4; returned5 bytes; legacy decode/reencode; future127; active+history list");
