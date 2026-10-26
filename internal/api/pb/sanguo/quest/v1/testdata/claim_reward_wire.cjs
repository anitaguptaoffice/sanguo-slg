// From repo root: node <this-file> <protobufjs-module-path> <Go -v test log>
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const pb = require(path.resolve(process.argv[2]));
require(path.resolve(process.argv[2], 'ext/descriptor'));
const sha = b => require('node:crypto').createHash('sha256').update(b).digest('hex');
const descriptor = fs.readFileSync(path.join(__dirname, 'claim_reward_legacy.pb'));
assert.equal(sha(descriptor), '0cfa3795de294ea732c0285f404f34e45672e39effa840533776b6ed25b867aa');
const legacy = fs.readFileSync(path.join(__dirname, 'claim_reward_legacy.bin'));
assert.equal(sha(legacy), '28b07ae5231f8261626188841061b51791ab0400c9a730bd6f8a8bbb18215d15');
const name = 'sanguo.quest.v1.ClaimQuestRewardResponse';
const old = pb.Root.fromDescriptor(descriptor).resolveAll().lookupType(name);
function load(base) {
  const root = new pb.Root();
  root.resolvePath = (_, p) => {
    const local = path.join(base, p);
    return fs.existsSync(local) ? local : path.join('spec/proto', p);
  };
  return root.loadSync('sanguo/quest/v1/quest.proto').resolveAll().lookupType(name);
}
const current = load('internal/api/proto'), canonical = load('spec/proto');
const shape = type => type.fieldsArray.map(f => [f.id, f.name, f.type, f.rule]);
assert.deepEqual(shape(current), shape(canonical));
assert.equal(old.fieldsArray.length, 3);
assert.equal(current.fieldsArray.length, 4);
assert.equal(current.fields.playerLevel.type, 'int32');
assert.equal(current.fields.playerLevel.partOf, null);
assert.equal(current.decode(legacy).playerLevel, 0);
const rows = [...fs.readFileSync(process.argv[3], 'utf8').matchAll(/Go wire level=(-?\d+): ([a-f0-9]+)/g)];
assert.deepEqual(rows.map(r => Number(r[1])), [0, 1, 5, 20, 2147483647, -2147483648]);
for (const [, value, hex] of rows) {
  const wire = Buffer.from(hex, 'hex'), decoded = current.decode(wire), oldDecoded = old.decode(wire);
  assert.equal(decoded.playerLevel, Number(value));
  assert.equal(decoded.grantedRewards.resources.food.toString(), '9007199254740993');
  assert.equal('playerLevel' in oldDecoded, false);
  assert.deepEqual(Buffer.from(old.encode(oldDecoded).finish()), legacy);
  assert.deepEqual(Buffer.from(current.encode(decoded).finish()), wire);
  assert.deepEqual(Buffer.from(canonical.encode(canonical.decode(wire)).finish()), wire);
  console.log(`PASS Go -> protobufjs level ${value}: frozen legacy keeps fields 1-3; new int32 unchanged`);
}
console.log('PASS runtime/canonical field parity, old reply level 0, exact cross-runtime bytes');
