import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SEND, LIST, destination, pendingWitness, withChatRuntime } from './live_chat_runtime.mjs';
export const MIXED = 'a'.repeat(499) + '😀';
export const CASES = [['mixed', MIXED], ['emoji', '😀'.repeat(500)], ['ascii', 'b'.repeat(500)],
  ['chinese', '中'.repeat(500)], ['trimmed', ' ' + '😀'.repeat(500) + ' '], ['pending', MIXED]];
export function inputState(state, raw) {
  assert.equal(state.value, raw); assert.equal(state.counter, `${[...raw].length}/500`);
  assert.equal(state.draft, raw || null);
}
export function rejection(state, raw, before, after, visible, reason) {
  inputState(state, raw); assert.equal(after, before); assert.equal(visible, reason);
}
export function baseline(state, sends) {
  inputState(state, 'a'.repeat(499)); assert.equal(sends, 0);
}
export function delivery(rows, content, owner, rendered) {
  const sends = rows.filter(r => r.route === SEND); assert.equal(sends.length, 1);
  const send = sends[0]; destination(send.request); assert.equal(send.request.content, content);
  assert.equal(send.code, 0); assert.ok(Number.isFinite(send.receivedAt));
  const message = send.response.message; assert.ok(Number.isSafeInteger(message.message_id) && message.message_id > 0);
  destination(message); assert.equal(message.sender_player_id, owner); assert.equal(message.content, content);
  assert.equal(send.response.limits.max_content_length, 500);
  const lists = rows.filter(r => r.route === LIST && r.sentAt >= send.receivedAt); assert.equal(lists.length, 1);
  const list = lists[0]; destination(list.request); assert.equal(list.code, 0);
  assert.ok(Number.isFinite(list.receivedAt) && list.receivedAt >= list.sentAt);
  const matches = list.response.messages.filter(m => m.message_id === message.message_id); assert.equal(matches.length, 1);
  assert.ok(Number.isSafeInteger(message.sent_at_ms) && message.sent_at_ms > 0);
  for (const key of ['message_id', 'sender_player_id', 'content', 'server_id', 'channel', 'recipient_player_id', 'guild_id', 'sent_at_ms']) {
    assert.equal(matches[0][key], message[key], `Persisted message field ${key}`);
  }
  send.displayNameComparison = { sent: message.sender_display_name, listed: matches[0].sender_display_name,
    equal: message.sender_display_name === matches[0].sender_display_name };
  assert.ok(rendered.includes(`: ${content}`)); return send;
}
export function inventory(cases, requests) {
  assert.deepEqual(cases, CASES.map(([name]) => name));
  assert.equal(requests.filter(r => r.route === SEND).length, 6);
}
export function overlap(start, end, events, raw, send) {
  const matches = events.filter(event => event.value === raw);
  return matches.length === 1 && (inputState(matches[0], raw), pendingWitness(start, end, matches[0], send.sentAt, send.receivedAt));
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
    report.baselineControl = 'native maxlength truncation reproduced; not fixed acceptance'; await screenshot('baseline'); return;
  }
  assert.equal(report.product, 'fixed'); await verify(MIXED);
  await act(() => page.keyboard.type('Z')); await verify(MIXED + 'Z'); await reject(MIXED + 'Z', '消息过长');
  await act(() => action('toggle-chat').click()); await act(() => action('toggle-chat').click()); await settled(); await verify(MIXED + 'Z');
  await act(() => input.click()); await act(() => input.press('End')); await act(() => input.press('Backspace'));
  await sendCase('mixed', MIXED);
  for (const raw of ['', '   ']) { await type(raw); await verify(raw); await reject(raw, '消息不能为空'); }
  for (const [name, raw] of CASES.slice(1)) { await type(raw); await sendCase(name, raw, name === 'pending'); }
  inventory(report.cases, report.requests); report.fixedAcceptance = true;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await withChatRuntime(scenario);
