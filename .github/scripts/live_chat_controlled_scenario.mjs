import assert from 'node:assert/strict';
import { SEND, LIST, destination } from './live_chat_runtime.mjs';
import { MIXED, CASES, inputState, rejection, baseline, inventory, overlap, delivery as originalDelivery } from './live_chat_unicode.mjs';
export const STABLE = ['message_id', 'sender_player_id', 'content', 'server_id', 'channel', 'recipient_player_id', 'guild_id', 'sent_at_ms'];
const equalMessage = (a, b) => STABLE.forEach(key => assert.equal(a[key], b[key], `Stable message field ${key}`));
function message(row, owner) {
  destination(row);
  for (const key of ['message_id', 'sender_player_id', 'sent_at_ms']) assert.ok(Number.isSafeInteger(row[key]) && row[key] > 0);
  assert.equal(row.sender_player_id, owner); assert.equal(row.recipient_player_id, 0); assert.equal(row.guild_id, 0);
  assert.equal(typeof row.content, 'string'); assert.ok([...row.content].length > 0 && [...row.content].length <= 500);
}
export function readbacks(rows, owner, final = false) {
  const sends = rows.filter(r => r.route === SEND), lists = rows.filter(r => r.route === LIST);
  const known = new Map(), seen = new Map(); let previousId = 0, previousTime = -Infinity;
  for (const row of rows) {
    assert.ok(Number.isSafeInteger(row.id) && row.id > previousId); previousId = row.id;
    assert.ok(Number.isFinite(row.sentAt) && row.sentAt >= previousTime); previousTime = row.sentAt;
    if (![SEND, LIST].includes(row.route)) continue;
    destination(row.request); assert.equal(row.code, 0);
    assert.ok(Number.isFinite(row.receivedAt) && row.receivedAt >= row.sentAt);
    assert.equal(row.response.limits.max_content_length, 500);
  }
  for (const send of sends) {
    const msg = send.response.message; message(msg, owner); assert.equal(send.request.content, msg.content);
    assert.ok(!known.has(msg.message_id)); known.set(msg.message_id, send);
  }
  for (const list of lists) {
    for (const [key, value] of [['peer_player_id', 0], ['guild_id', 0], ['before_message_id', 0], ['limit', 30]]) assert.equal(list.request[key], value);
    assert.ok(Array.isArray(list.response.messages) && list.response.messages.length <= 30);
    let previousMessage = 0; list.displayNameComparisons = [];
    for (const msg of list.response.messages) {
      message(msg, owner); assert.ok(msg.message_id > previousMessage); previousMessage = msg.message_id;
      if (seen.has(msg.message_id)) equalMessage(msg, seen.get(msg.message_id));
      seen.set(msg.message_id, msg);
      if (final) assert.ok(known.has(msg.message_id), 'Unknown listed message');
      if (known.has(msg.message_id)) {
        const sent = known.get(msg.message_id); assert.ok(list.receivedAt >= sent.sentAt, 'Read completed before Send began');
        equalMessage(msg, sent.response.message);
        list.displayNameComparisons.push({ send: sent.id, message: msg.message_id, sent: sent.response.message.sender_display_name,
          listed: msg.sender_display_name, equal: sent.response.message.sender_display_name === msg.sender_display_name });
      }
    }
    for (const send of sends.filter(s => list.sentAt >= s.receivedAt)) {
      const found = list.response.messages.filter(m => m.message_id === send.response.message.message_id);
      assert.equal(found.length, 1); equalMessage(found[0], send.response.message);
    }
  }
  if (final) for (const send of sends) assert.ok(lists.some(list => list.sentAt >= send.receivedAt), 'Missing post-reply read');
  return lists;
}
export function delivery(rows, content, owner, rendered) {
  const lists = readbacks(rows, owner), sends = rows.filter(r => r.route === SEND); assert.equal(sends.length, 1);
  const send = sends[0], after = lists.filter(list => list.sentAt >= send.receivedAt); assert.ok(after.length > 0);
  const comparisons = [];
  for (const list of after) {
    originalDelivery([send, list], content, owner, rendered);
    comparisons.push({ list: list.id, ...send.displayNameComparison });
  }
  send.displayNameComparisons = comparisons; return send;
}
export async function scenario(ctx) {
  const { page, panel, action, report, owner, act, pause, eventually, settled, calibrate, screenshot, save } = ctx;
  const input = panel.locator('[data-field="chat-content"]'), sendButton = panel.locator('[data-action="send-chat"]');
  report.cases = []; report.inputMethod = 'native Playwright keyboard.type / press';
  const count = () => report.requests.filter(r => r.route === SEND).length;
  const read = () => act(() => input.evaluate(element => ({ value: element.value,
    counter: document.querySelector('[data-center-panel="chat"] [data-role="chat-input-counter"]').textContent,
    draft: sessionStorage.getItem('guild-chat-draft-v1') })));
  const verify = async raw => { const state = await read(); inputState(state, raw); return state; };
  async function type(raw) {
    await act(() => input.click()); await act(() => input.press('Control+A')); await act(() => input.press('Backspace'));
    if (raw) await act(() => page.keyboard.type(raw));
  }
  async function reject(raw, reason) {
    const before = count(); await act(() => sendButton.click());
    const status = page.locator('#hud .hud-group').filter({ hasText: new RegExp(`^${reason}$`) });
    await act(() => status.waitFor({ state: 'visible' })); await settled();
    const state = await read(); rejection(state, raw, before, count(), await act(() => status.textContent()), reason);
    (report.rejections ||= []).push({ raw, state, before, after: count(), reason }); save();
  }
  async function rateWait() {
    const last = report.requests.filter(r => r.route === SEND).at(-1); if (!last) return;
    const { limits, next_allowed_at_ms, remaining_in_window } = last.response;
    assert.ok(Number.isFinite(next_allowed_at_ms) && remaining_in_window >= 0);
    assert.ok(limits.min_interval_ms >= 0 && limits.window_ms > 0);
    const wait = Math.max(0, next_allowed_at_ms - Date.now(), limits.min_interval_ms,
      remaining_in_window === 0 ? limits.window_ms : 0);
    report.waits ||= []; report.waits.push(wait); if (wait) await pause(wait);
  }
  async function sendCase(name, raw, pending = false) {
    await verify(raw); await rateWait(); const offset = report.requests.length;
    const start = pending ? await calibrate() : null;
    const inputOffset = pending ? await act(() => page.evaluate(() => window.__chatEvidence.length)) : 0;
    await act(() => sendButton.click());
    if (pending) { await act(() => input.focus()); await act(() => input.press('End')); await act(() => page.keyboard.type('Z')); }
    await eventually(async () => count() === report.cases.length + 1 && await sendButton.isEnabled(), 'Send did not complete');
    await settled();
    const rendered = await act(() => panel.locator('.chat-body').allTextContents());
    const send = delivery(report.requests.slice(offset), raw.trim(), owner, rendered);
    report.cases.push(name);
    if (pending) {
      const end = await calibrate(), events = await act(() => page.evaluate(offset => window.__chatEvidence.slice(offset), inputOffset));
      report.pending = { start, end, events, send: send.id, observed: overlap(start, end, events, raw + 'Z', send) };
      if (!report.pending.observed) { report.pending.coverage = 'UNOBSERVED'; save(); throw new Error('UNOBSERVED native Send/newer501 overlap; no retry'); }
      await verify(raw + 'Z'); await reject(raw + 'Z', '消息过长');
    } else await verify('');
    await screenshot(name); save();
  }
  await type(MIXED);
  if (report.product === 'baseline') {
    report.baseline = await read(); baseline(report.baseline, count());
    report.baselineControl = 'native maxlength truncation reproduced; not fixed acceptance'; await screenshot('baseline'); readbacks(report.requests, owner, true); return;
  }
  assert.equal(report.product, 'fixed'); await verify(MIXED);
  await act(() => page.keyboard.type('Z')); await verify(MIXED + 'Z'); await reject(MIXED + 'Z', '消息过长');
  await act(() => action('toggle-chat').click()); await act(() => action('toggle-chat').click()); await settled(); await verify(MIXED + 'Z');
  await act(() => input.click()); await act(() => input.press('End')); await act(() => input.press('Backspace'));
  await sendCase('mixed', MIXED);
  for (const raw of ['', '   ']) { await type(raw); await verify(raw); await reject(raw, '消息不能为空'); }
  for (const [name, raw] of CASES.slice(1)) { await type(raw); await sendCase(name, raw, name === 'pending'); }
  inventory(report.cases, report.requests); readbacks(report.requests, owner, true); report.fixedAcceptance = true;
}
