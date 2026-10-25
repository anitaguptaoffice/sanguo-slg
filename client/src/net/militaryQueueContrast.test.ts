import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { syncMilitaryRecruitQueueList } from './recruitTroopSubmitFeedback';

const html = readFileSync('index.html', 'utf8');
const selector = '.military-panel .military-recruit-queue li.queue-list-row';
const ink = html.slice(html.indexOf(selector)).match(/color:\s*(#[0-9a-f]+)/)![1];
function luminance(hex: string) {
  return hex.slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255)
    .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
}
describe('military dark queue surface foreground', () => {
  it('has AA normal-text contrast including the completion pulse surface', () => {
    for (const background of ['#1a1410', '#1a2828', '#1e2a22']) {
      expect((luminance(ink) + .05) / (luminance(background) + .05)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('changes only foreground, leaving geometry and selected outlines untouched', () => {
    const declarations = html.slice(html.indexOf(selector)).match(/\{([^}]+)\}/)![1].trim();
    expect(declarations).toBe('color: #e8dcc8;');
  });
  it('keeps queued, selected and completed text on the same production row surface', () => {
    const panel = document.createElement('div');
    panel.innerHTML = '<ul class="queue-list military-recruit-queue" data-role="military-recruit-queue-list"></ul>';
    const entry = { queue_id: 7, unit_cfg_id: 1, count: 20, finish_at_ms: 10000 };
    syncMilitaryRecruitQueueList(panel, [entry], 0, 7);
    expect(panel.querySelector('li')?.classList.contains('selected')).toBe(true);
    expect(panel.querySelector('li')?.textContent).toContain('步兵×20');
    syncMilitaryRecruitQueueList(panel, [entry], 11000);
    expect(panel.querySelector('li')?.textContent).toContain('已完成');
    expect(panel.querySelector('li')?.classList.contains('selected')).toBe(false);
    syncMilitaryRecruitQueueList(panel, [], 11000);
    expect(panel.querySelector('ul')?.classList.contains('hidden')).toBe(true);
  });
});
