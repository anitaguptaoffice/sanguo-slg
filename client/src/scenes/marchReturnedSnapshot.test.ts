import { afterEach, describe, expect, it, vi } from 'vitest';
import { MainCityScene } from './MainCityScene';
import { MarchListPanel } from '@/ui/MarchListPanel';
import { formatMarchHint } from '@/net/militaryFormat';
import { countIntelInProgressMarches } from '@/net/hudMilitaryTodoSweep';
import { resolveMarchFormReadonlyStripModel } from '@/net/marchFormReadonlyStrip';
const returned = { march_id: 7, phase: 5, from_x: 60, from_y: 60, to_x: 5, to_y: 5, arrive_at_ms: 2000, return_finish_at_ms: 0 };
const panels: MarchListPanel[] = [];
afterEach(() => { panels.forEach(p => p.detach()); panels.length = 0; document.body.replaceChildren(); sessionStorage.clear(); vi.useRealTimers(); });
async function setup() {
  vi.useFakeTimers();
  const mount = document.createElement('div'); document.body.append(mount);
  const panel = new MarchListPanel(mount, { listMarches: async () => ({ marches: [{ ...returned, phase: 4, return_finish_at_ms: 60000 }], total: 1 }) } as never, () => 31, () => {});
  panels.push(panel); panel.attach(); panel.toggle(); await vi.advanceTimersByTimeAsync(0);
  mount.querySelector<HTMLElement>('.march-list li[data-march-id="7"]')!.click(); panel.toggle();
  const scene = new MainCityScene() as unknown as Record<string, any>;
  Object.assign(scene, { session: { cityId: 31 }, lastMarch: { ...returned, phase: 2 }, marchList: panel,
    gateway: { listMarches: async () => ({ marches: [returned], total: 1 }) }, world: { refreshMarchDestCounts: vi.fn() } });
  await scene.refreshMinimapMarches();
  expect(scene.minimapMarches[0].phase).toBe(5);
  return { scene, panel };
}
describe('independent MainCity authoritative snapshot propagation', () => {
  it('updates actual last-started march hint from a returned ListMarches row', async () => {
    const { scene } = await setup();
    expect(formatMarchHint(scene.lastMarch)).toContain('已回城');
  });
  it('clears world active count when its preferred panel snapshot has been authoritatively returned', async () => {
    const { scene, panel } = await setup();
    const fromPanel = panel.getMarches();
    const worldSnapshot = fromPanel.length ? fromPanel : scene.minimapMarches;
    expect(countIntelInProgressMarches(worldSnapshot)).toBe(0);
  });
  it('does not let closed-panel selected phase4 override authoritative returned5 readout', async () => {
    const { scene, panel } = await setup();
    const strip = resolveMarchFormReadonlyStripModel({ intelSelectedMarch: panel.getSelectedMarch(), queueBannerMarchId: 7,
      queueBannerMarch: scene.minimapMarches[0], formRoot: null, nowMs: 3000 });
    expect(strip.summaryLine).toContain('已回城');
    expect(strip.summaryLine).not.toMatch(/剩余|即将|ETA/);
  });
});
