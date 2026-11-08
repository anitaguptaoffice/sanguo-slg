import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SEND, LIST } from './live_chat_runtime.mjs';
import { MIXED, CASES, inputState, rejection, baseline, delivery, inventory, overlap, scenario } from './live_chat_unicode.mjs';
let checks = 0;
const reject = fn => { assert.throws(fn); checks++; };
const state = raw => ({ value: raw, counter: `${[...raw].length}/500`, draft: raw || null });
const destination = { server_id: 1, channel: 1, recipient_player_id: 0, guild_id: 0 };
const message = { ...destination, sender_player_id: 17, message_id: 42, content: MIXED, sent_at_ms: 1000, sender_display_name: 'synthetic' };
const rows = () => [{ id: 1, route: SEND, sentAt: 101, receivedAt: 103, code: 0,
  request: { ...destination, content: MIXED }, response: { message: structuredClone(message), limits: { max_content_length: 500 } } },
{ id: 2, route: LIST, sentAt: 104, receivedAt: 105, code: 0, request: { ...destination, peer_player_id: 0 }, response: { messages: [structuredClone(message)] } }];
const checkDelivery = data => delivery(data, MIXED, 17, [`: ${MIXED}`]);
assert.deepEqual(CASES.map(([name]) => name), ['mixed', 'emoji', 'ascii', 'chinese', 'trimmed', 'pending']);
assert.equal(MIXED.length, 501); assert.equal([...MIXED].length, 500);
for (const [, raw] of CASES) { assert.equal([...raw.trim()].length, 500); inputState(state(raw), raw); }
assert.equal([...CASES[4][1]].length, 502); assert.equal(CASES[4][1].trim(), CASES[1][1]);
for (const raw of ['', '   ', MIXED, MIXED + 'Z', CASES[4][1]]) {
  inputState(state(raw), raw);
  for (const [key, value] of [['value', 'lost'], ['counter', '0/500'], ['draft', 'lost']]) {
    if (state(raw)[key] !== value) reject(() => inputState({ ...state(raw), [key]: value }, raw));
  }
  rejection(state(raw), raw, 2, 2, '消息过长', '消息过长');
  reject(() => rejection(state(raw), raw, 2, 3, '消息过长', '消息过长'));
  reject(() => rejection(state(raw), raw, 2, 2, '已发送', '消息过长'));
}
reject(() => inputState(state(MIXED), MIXED + 'Z')); reject(() => inputState(state(MIXED), ''));
baseline(state('a'.repeat(499)), 0);
reject(() => baseline(state(MIXED), 0)); reject(() => baseline(state('a'.repeat(499)), 1));
reject(() => inputState(state('a'.repeat(499)), MIXED));
assert.equal(checkDelivery(rows()).response.message.message_id, 42);
const persisted = rows(); persisted[1].response.messages[0].sender_display_name = '';
assert.deepEqual(checkDelivery(persisted).displayNameComparison, { sent: 'synthetic', listed: '', equal: false });
const mutations = [
  data => data.splice(0, 1), data => data.push(structuredClone(data[0])),
  data => data[0].code = 1, data => data[0].receivedAt = undefined,
  data => data[0].request.content = 'lost', data => data[0].request.server_id = 2,
  data => data[0].request.channel = 2, data => data[0].request.recipient_player_id = 9,
  data => data[0].request.guild_id = 9, data => data[0].response.limits.max_content_length = 499,
  data => data[0].response.message.message_id = 0, data => data[0].response.message.message_id = 1.5,
  data => data[0].response.message.sent_at_ms = 0, data => data[0].response.message.content = 'lost', data => data[0].response.message.sender_player_id = 19,
  data => data[0].response.message.server_id = 2, data => data[0].response.message.channel = 3,
  data => data[0].response.message.recipient_player_id = 9, data => data[0].response.message.guild_id = 9,
  data => data.splice(1, 1), data => data.push(structuredClone(data[1])),
  data => data[1].sentAt = 102, data => data[1].code = 1,
  data => data[1].receivedAt = undefined, data => data[1].receivedAt = 103,
  data => data[1].request.server_id = 2, data => data[1].request.channel = 2,
  data => data[1].request.peer_player_id = 9, data => data[1].response.messages = [],
  data => data[1].response.messages.push(structuredClone(message)),
];
for (const mutate of mutations) { const data = rows(); mutate(data); reject(() => checkDelivery(data)); }
for (const key of ['message_id', 'content', 'sender_player_id', 'server_id', 'channel', 'recipient_player_id', 'guild_id', 'sent_at_ms']) {
  const data = rows(); data[1].response.messages[0][key] = key === 'content' ? 'corrupt' : 99;
  reject(() => checkDelivery(data));
}
reject(() => delivery(rows(), MIXED, 17, [MIXED])); reject(() => delivery(rows(), MIXED, 17, [': lost']));
reject(() => delivery(rows(), MIXED, 17, [])); reject(() => delivery(rows(), MIXED, 99, [`: ${MIXED}`]));
const names = CASES.map(([name]) => name), sends = Array.from({ length: 6 }, () => ({ route: SEND }));
inventory(names, sends);
for (let n = 0; n < names.length; n++) reject(() => inventory(names.filter((_, i) => i !== n), sends));
reject(() => inventory([...names, 'extra'], sends)); reject(() => inventory(names, sends.slice(1)));
reject(() => inventory(names, [...sends, sends[0]])); reject(() => inventory([...names].reverse(), sends));
const raw = MIXED + 'Z', event = { ...state(raw), trusted: true, at: 2000 }, send = rows()[0];
assert.equal(overlap([99.9, 100.1], [99.95, 100.05], [event], raw, send), true);
for (const events of [[], [{ ...event, value: 'Z' }], [event, event], [{ ...event, at: 4000 }]]) {
  assert.equal(overlap([99.9, 100.1], [99.95, 100.05], events, raw, send), false); checks++;
}
for (const key of ['counter', 'draft']) reject(() => overlap([99, 101], [99, 101], [{ ...event, [key]: 'bad' }], raw, send));
reject(() => overlap([99, 101], [99, 101], [{ ...event, trusted: false }], raw, send));
reject(() => overlap([99, 100], [101, 102], [event], raw, send));
assert.equal(overlap([99.9, 100.1], [99.95, 100.05], [event], raw, { ...send, receivedAt: 102 }), false); checks++;
{
  const report = {}; let nativeActions = 0;
  await assert.rejects(scenario({ report, page: {}, panel: { locator: () => ({ click() { nativeActions++; throw new Error('native action failed'); } }) },
    act: fn => fn() }), /native action failed/);
  assert.equal(nativeActions, 1); assert.equal(report.fixedAcceptance, undefined);
}
const source = readFileSync(new URL('./live_chat_unicode.mjs', import.meta.url), 'utf8');
for (const forbidden of ['.fill(', 'dispatchEvent(', 'routeWebSocket(', 'page.route(', 'new WebSocket(']) assert.ok(!source.includes(forbidden));
assert.ok(!/\.value\s*=(?!=)/.test(source));
for (const required of ['UNOBSERVED', "page.keyboard.type('Z')", 'pendingWitness', 'inventory(report.cases', 'await settled()', 'remaining_in_window']) assert.ok(source.includes(required));
console.log(`PASS ${checks} scenario rejection controls plus manifest, native state and delivery positives; no browser/services started`);
