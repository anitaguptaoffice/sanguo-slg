import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SEND, LIST } from './live_chat_runtime.mjs';
import { MIXED } from './live_chat_unicode.mjs';
import { delivery, readbacks, scenario, STABLE } from './live_chat_controlled_scenario.mjs';
let checks = 0;
const reject = fn => { assert.throws(fn); checks++; };
const destination = { server_id: 1, channel: 1, recipient_player_id: 0, guild_id: 0 };
const msg = () => ({ ...destination, message_id: 1, sender_player_id: 17, content: MIXED, sent_at_ms: 1000, sender_display_name: '' });
const send = () => ({ id: 2, route: SEND, sentAt: 10, receivedAt: 11, code: 0,
  request: { ...destination, content: MIXED }, response: { message: msg(), limits: { max_content_length: 500 } } });
const list = (id, sentAt, messages = [msg()]) => ({ id, route: LIST, sentAt, receivedAt: sentAt + 0.5, code: 0,
  request: { server_id: 1, channel: 1, guild_id: 0, peer_player_id: 0, before_message_id: 0, limit: 30 },
  response: { messages, limits: { max_content_length: 500 } } });
const rows = () => [list(1, 9, []), send(), list(3, 12), list(4, 13)];
const check = data => delivery(data, MIXED, 17, [`: ${MIXED}`]);
assert.equal(check(rows()).id, 2); readbacks(rows(), 17, true);
assert.equal(check(rows()).displayNameComparisons.length, 2);
const initial = [list(1, 1, [])]; readbacks(initial, 17, true);
reject(() => readbacks([list(1, 1)], 17, true));
const overlapping = [list(1, 9), send(), list(3, 12)];
overlapping[0].receivedAt = 11.5; readbacks(overlapping, 17, true); check(overlapping);
assert.equal(overlapping[0].displayNameComparisons.length, 1);
const impossible = [list(1, 9), send(), list(3, 12)];
reject(() => readbacks(impossible, 17, true)); // Response9.5 cannot know a Send initiated10.
const reversedCompletion = rows(); reversedCompletion[2].receivedAt = 15;
readbacks(reversedCompletion, 17, true); assert.equal(reversedCompletion[3].displayNameComparisons.length, 1); // Genuine response completion order need not match request order.
const optional = rows(); optional[1].response.message.sender_display_name = 'demo';
assert.equal(check(optional).displayNameComparisons.every(x => x.equal === false), true);
for (const mutate of [
  d => d.splice(1, 1), d => d.push({ ...send(), id: 5, sentAt: 14, receivedAt: 15 }),
  d => d[1].code = 1, d => d[1].request.content = 'lost', d => d[1].response.message.content = 'lost',
  d => d[1].response.limits.max_content_length = 499, d => d[1].receivedAt = undefined,
  d => d[1].receivedAt = 9, d => d[1].sentAt = NaN, d => d[1].id = 1,
  d => d[1].response.message.message_id = 0, d => d[1].response.message.sent_at_ms = 0,
  d => d[1].response.message.sender_player_id = 18, d => d[1].request.channel = 2,
  d => d.splice(2), d => d[2].response.messages = [], d => d[3].response.messages = [],
]) { const d = rows(); mutate(d); reject(() => check(d)); }
for (const index of [0, 2, 3]) {
  for (const [key, value] of [['server_id', 2], ['channel', 2], ['peer_player_id', 9], ['guild_id', 1], ['before_message_id', 1], ['limit', 29]]) {
    const d = rows(); d[index].request[key] = value; reject(() => check(d));
  }
  for (const mutate of [
    r => r.code = 1, r => r.receivedAt = undefined, r => r.receivedAt = r.sentAt - 1,
    r => r.sentAt = NaN, r => r.id = 0, r => r.response = undefined,
    r => r.response.messages = null, r => r.response.messages = {},
    r => r.response.limits.max_content_length = 499,
  ]) { const d = rows(); mutate(d[index]); reject(() => check(d)); }
}
for (const index of [2, 3]) {
  for (const key of STABLE) {
    const d = rows(); d[index].response.messages[0][key] = key === 'content' ? 'corrupt' : 99;
    reject(() => check(d));
  }
  for (const mutate of [
    m => m.content = '', m => m.content = 'x'.repeat(501), m => m.content = 7,
    m => m.message_id = 1.5, m => m.sent_at_ms = NaN, m => m.sender_player_id = 0,
  ]) { const d = rows(); mutate(d[index].response.messages[0]); reject(() => check(d)); }
  const duplicate = rows(); duplicate[index].response.messages.push(msg()); reject(() => check(duplicate));
}
const unknown = rows(); unknown[3].response.messages.push({ ...msg(), message_id: 99 });
reject(() => readbacks(unknown, 17, true)); // Valid-looking extra own-actor message cannot escape attribution.
const beforeUnknown = rows(); beforeUnknown[0].response.messages = [{ ...msg(), message_id: 99 }];
reject(() => readbacks(beforeUnknown, 17, true));
const badBefore = rows(); badBefore[0].response.messages = [{ ...msg(), content: 'wrong' }];
reject(() => readbacks(badBefore, 17, true));
const lateBad = rows(); lateBad.push(list(5, 20, [])); reject(() => readbacks(lateBad, 17, true));
const earlyOnly = [list(1, 9), send()]; reject(() => readbacks(earlyOnly, 17, true));
const two = rows(); const second = send(); second.id = 5; second.sentAt = 14; second.receivedAt = 15;
second.request.content = 'second'; second.response.message = { ...msg(), message_id: 2, content: 'second', sent_at_ms: 2000 };
two.push(second, list(6, 16, [msg(), structuredClone(second.response.message)])); readbacks(two, 17, true);
const missingPrior = structuredClone(two); missingPrior.at(-1).response.messages.shift(); reject(() => readbacks(missingPrior, 17, true));
const reversed = structuredClone(two); reversed.at(-1).response.messages.reverse(); reject(() => readbacks(reversed, 17, true));
const duplicateSendId = structuredClone(two); duplicateSendId[4].response.message.message_id = 1; reject(() => readbacks(duplicateSendId, 17, true));
for (const rendered of [[], [MIXED], [': lost']]) reject(() => delivery(rows(), MIXED, 17, rendered));
reject(() => delivery(rows(), MIXED, 18, [`: ${MIXED}`]));
const own = readFileSync(new URL('./live_chat_controlled_scenario.mjs', import.meta.url), 'utf8');
const original = readFileSync(new URL('./live_chat_unicode.mjs', import.meta.url), 'utf8');
const originalBody = original.slice(original.indexOf('export async function scenario'), original.indexOf('if (process.argv[1]'));
const actualBody = own.slice(own.indexOf('export async function scenario')).replaceAll('readbacks(report.requests, owner, true); ', '');
assert.equal(actualBody, originalBody); // Entire native flow preserved, including strict pending/rejection/timing gates.
for (const forbidden of ['.fill(', 'dispatchEvent(', 'routeWebSocket(', 'page.route(', 'new WebSocket(']) assert.ok(!own.includes(forbidden));
assert.ok(!/\.value\s*=(?!=)/.test(own));
const report = {}; let actions = 0;
await assert.rejects(scenario({ report, page: {}, panel: { locator: () => ({ click() { actions++; throw Error('native failure'); } }) }, act: fn => fn() }), /native failure/);
assert.equal(actions, 1); assert.equal(report.fixedAcceptance, undefined);
console.log(`PASS ${checks} controlled readback rejection controls plus multiple-List/initial/inflight positives and exact native-body comparison`);
