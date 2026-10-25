'use strict';
// Contract-only binary test; no runtime or generated code is changed.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const protobuf = require(process.env.PROTOBUFJS_PATH ||
  path.resolve(__dirname, '../../../client/node_modules/protobufjs'));
const repo = path.resolve(__dirname, '../../..');
const spec = path.join(repo, 'spec/proto');
const active = path.join(repo, 'internal/api/proto');

function load(base, file) {
  const root = new protobuf.Root();
  root.resolvePath = (_, target) => {
    if (path.isAbsolute(target)) return target;
    const local = path.join(base, target);
    return fs.existsSync(local) ? local : path.join(spec, target);
  };
  root.loadSync(path.join(base, file), { keepCase: true }).resolveAll();
  return root.lookupType('sanguo.domestic.v1.GetCityStateResponse');
}
const old = load(active, 'sanguo/domestic/v1/extra.proto');
const next = load(spec, 'sanguo/domestic/v1/domestic.proto');
const fields = type => type.fieldsArray.map(f => [f.name, f.id, f.type, f.repeated]);
assert.deepEqual(fields(old), [
  ['wallet', 1, 'sanguo.common.v1.ResourceWallet', false],
  ['buildings', 2, 'sanguo.common.v1.CityBuilding', true],
  ['production_rates', 3, 'sanguo.common.v1.ResourceWallet', false],
]);
assert.deepEqual(fields(next).slice(0, 3), fields(old));
assert.deepEqual(fields(next)[3], ['garrison', 4, 'CityGarrisonSnapshot', false]);
const normalize = (type, message) => type.toObject(message, { longs: String });
const encode = (type, value) => {
  const message = type.fromObject(value);
  assert.equal(type.verify(message), null);
  return type.encode(message).finish();
};
const owns = (message, key) => Object.prototype.hasOwnProperty.call(message, key);
const baseline = {
  wallet: { food: '9007199254740993', wood: '202', iron: '303', stone: '404', gold: '505' },
  buildings: [{ slot_key: 'barracks', building_cfg_id: 1001, level: 1,
    upgrade_finish_at_ms: '1793037000123' }],
  production_rates: { food: '11', wood: '22', iron: '33', stone: '44', gold: '0' },
};
const oldBytes = encode(old, baseline);
const expected = normalize(old, old.decode(oldBytes));
assert.deepEqual(encode(next, baseline), oldBytes, 'fields 1-3 must be byte-identical');
const oldToNew = next.decode(oldBytes);
assert.equal(owns(oldToNew, 'garrison'), false);
assert.equal(oldToNew.garrison, null);
assert.deepEqual(normalize(next, oldToNew), expected);
console.log('PASS old -> new: wallet/buildings/rates unchanged, garrison absent');

for (const garrison of [{}, { troops: [] }, { troops: [
  { unit_cfg_id: 1001, count: 1 }, { unit_cfg_id: 1002, count: 2147483647 },
] }]) {
  const bytes = encode(next, { ...baseline, garrison });
  assert.deepEqual(normalize(old, old.decode(bytes)), expected, 'old decoder ignores field 4');
  const decoded = next.decode(bytes);
  assert.equal(owns(decoded, 'garrison'), true);
  assert.deepEqual(normalize(next, decoded).garrison,
    normalize(next, next.fromObject({ garrison })).garrison);
  assert.deepEqual(encode(next, decoded), bytes, 'presence survives re-encode');
}
console.log('PASS new -> old: unknown field 4 ignored, fields 1-3 unchanged');
assert.deepEqual([...encode(next, {})], []);
assert.deepEqual([...encode(next, { garrison: {} })], [0x22, 0x00]);
assert.equal(owns(next.decode(Uint8Array.from([0x22, 0x00])), 'garrison'), true);
assert.equal(owns(next.decode(new Uint8Array()), 'garrison'), false);
console.log('PASS absent vs present-empty: [] versus [0x22, 0x00]');
console.log('PASS populated snapshot and int32 upper bound round-trip');
