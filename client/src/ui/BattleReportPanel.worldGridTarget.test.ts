import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BattleReportPanel } from './BattleReportPanel';
import { WorldPanels } from './WorldPanels';
import type { GatewayPort } from '@/net/GatewayClient';
import type { MainCitySession } from '@/net/bootstrapSession';
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const now = Date.now();
const recent = Array.from({length:20}, (_,i) => ({report_id:21-i, location_x:9, location_y:9, outcome:1, created_at_ms:now-i*1000}));
const wanted = {report_id:1, location_x:5, location_y:5, outcome:1, created_at_ms:now-21000};
beforeEach(() => { sessionStorage.clear(); document.body.innerHTML = ''; });
describe('production world battle shortcut discovery', () => {
  it('page2 replay -> world shortcut must not open unrelated page1 report', async () => {
    const mount = document.createElement('div'); document.body.append(mount);
    const gateway = {
      listBattleReports: vi.fn(async (_limit:number, offset:number) => ({reports: offset ? [wanted] : recent, total:21})),
      getBattleReport: vi.fn(async (id:number) => ({report: {summary: [...recent,wanted].find(r=>r.report_id===id), detail: {result:`result-${id}`}}})),
      listPlayerCities: vi.fn(async () => ({cities:[]})),
    };
    let world!: WorldPanels;
    const panel = new BattleReportPanel(mount,gateway as unknown as GatewayPort,()=>{}, {
      onOpenReplayWorldTile: summary => { world.openPanel(); world.selectGridAt(summary.location_x!,summary.location_y!); },
    });
    const session = {serverId:1,cityId:1,cityName:'city',player:{},wallet:{},buildings:[],cityTroops:[],bag:[]} as MainCitySession;
    let link!: Promise<void>;
    world = new WorldPanels(mount,gateway as unknown as GatewayPort,()=>session,{},()=>{}, {
      getBattleReportsSnapshot:()=>panel.getReportsSnapshot(),
      onViewBattleReportsAtGrid:(grid,id)=>{link=panel.openListFilteredByGrid(grid.x,grid.y,id);},
    });
    panel.attach(); world.attach(); panel.openPanel(); await flush();
    panel.getRoot().querySelector<HTMLButtonElement>('[data-action="load-more-reports"]')!.click(); await flush();
    expect(panel.getReportsSnapshot()).toHaveLength(21);
    panel.getRoot().querySelector<HTMLButtonElement>('li[data-report-id="1"] [data-action="open-replay-world-tile"]')!.click(); await flush();
    const shortcut=world.getRoot().querySelector<HTMLButtonElement>('[data-action="view-battle-reports-at-grid"]')!;
    expect(shortcut.classList.contains('hidden')).toBe(false);
    expect(shortcut.dataset.reportId).toBe('1'); shortcut.click(); await link;
    expect(gateway.listBattleReports.mock.calls).toEqual([[20,0],[20,20],[20,0]]);
    expect(panel.getLocationFilter()).toEqual({x:5,y:5});
    expect(panel.getRoot().querySelector('[data-role="report-list"]')!.textContent).toContain('无匹配');
    expect(gateway.getBattleReport).toHaveBeenCalledWith(1);
    expect(gateway.getBattleReport).not.toHaveBeenCalledWith(21);
    expect(panel.getReportsSnapshot()).toHaveLength(20);
    panel.getRoot().querySelector<HTMLButtonElement>('[data-action="load-more-reports"]')!.click(); await flush();
    expect(gateway.listBattleReports).toHaveBeenLastCalledWith(20, 20);
    expect(panel.getReportsSnapshot()).toHaveLength(21);
    expect(gateway.getBattleReport).toHaveBeenCalledTimes(1);
    panel.detach(); world.detach();
  });
});

it('records current explicit matching-hint behavior with preserved outcome filter', async () => {
  sessionStorage.setItem('battle-report-outcome-filter-v1','win');
  const mount=document.createElement('div'); document.body.append(mount);
  const losing={...wanted,outcome:2};
  const gateway={listBattleReports:vi.fn(async()=>({reports:[recent[0],losing],total:2})), getBattleReport:vi.fn(async(id:number)=>({report:{summary:losing,detail:{result:`result-${id}`}}}))};
  const panel=new BattleReportPanel(mount,gateway as unknown as GatewayPort,()=>{});
  panel.attach(); await panel.openListFilteredByGrid(5,5,1);
  expect(sessionStorage.getItem('battle-report-outcome-filter-v1')).toBe('win');
  expect(panel.getRoot().querySelector('[data-role="report-list"]')!.textContent).toContain('无匹配');
  expect(gateway.getBattleReport).toHaveBeenCalledWith(1);
  expect(panel.getRoot().querySelector('[data-role="report-detail"]')!.textContent).toContain('result-1');
  panel.detach();
});

function fixture() {
  let generation = 1, server = 1;
  const mount = document.createElement('div'); document.body.append(mount);
  const status = vi.fn(), clearReplay = vi.fn();
  const gateway = {
    getSessionId: () => 'token', getSessionGeneration: () => generation, getBoundServerId: () => server,
    listBattleReports: vi.fn(async () => ({ reports: [wanted], total: 1 })),
    getBattleReport: vi.fn(async (id: number) => ({ report: { summary: id === 1 ? wanted : recent[0], detail: { result: `result-${id}` } } })),
  };
  const panel = new BattleReportPanel(mount, gateway as unknown as GatewayPort, status, {onClearMapReplay: clearReplay});
  panel.attach();
  const click = (action: string) => panel.getRoot().querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  return { panel, gateway, status, clearReplay, click, relogin: (sid = server) => { server = sid; generation++; } };
}
it.each([undefined, 999, 21])('unknown/wrong-grid hint %s falls back only inside visible grid', async hint => {
  const f = fixture(); f.gateway.listBattleReports.mockResolvedValue({ reports: [recent[0], wanted], total: 2 });
  await f.panel.openListFilteredByGrid(5, 5, hint);
  expect(f.gateway.getBattleReport.mock.calls).toEqual([[1]]); f.panel.detach();
});
it('no matching target clears prior detail and replay without an unrelated request', async () => {
  const f = fixture(); await f.panel.openPanelWithDeepLink(1); f.gateway.getBattleReport.mockClear();
  f.gateway.listBattleReports.mockResolvedValue({reports: recent, total: 20});
  await f.panel.openListFilteredByGrid(4, 4, 999);
  expect(f.gateway.getBattleReport).not.toHaveBeenCalled();
  expect(f.panel.getRoot().querySelector('[data-role="report-detail"]')!.textContent).toBe('');
  expect(f.clearReplay).toHaveBeenCalled(); f.panel.detach();
});
it('filtered fallback never opens a hidden outcome row or rewrites remembered filters', async () => {
  sessionStorage.setItem('battle-report-outcome-filter-v1', 'loss');
  const f = fixture(); await f.panel.openListFilteredByGrid(5, 5);
  expect(f.gateway.getBattleReport).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('battle-report-outcome-filter-v1')).toBe('loss'); f.panel.detach();
});
it.each(['server', 'relogin', 'aba'])('cached hint cannot cross %s ownership', async mode => {
  const f = fixture(); f.panel.openPanel(); await flush();
  if (mode === 'server') f.relogin(2);
  if (mode === 'relogin') f.relogin();
  if (mode === 'aba') { f.relogin(2); f.relogin(1); }
  f.gateway.listBattleReports.mockResolvedValue({reports: recent, total: 20});
  await f.panel.openListFilteredByGrid(5, 5, 1);
  expect(f.gateway.getBattleReport).not.toHaveBeenCalled(); f.panel.detach();
});
it('fresh matching hint is allowed after switching actors', async () => {
  const f = fixture(); f.panel.openPanel(); await flush(); f.relogin(2);
  await f.panel.openListFilteredByGrid(5, 5, 1);
  expect(f.gateway.getBattleReport.mock.calls).toEqual([[1]]); f.panel.detach();
});
it('fresh contradictory coordinates override an otherwise valid cached hint', async () => {
  const f = fixture(); f.panel.openPanel(); await flush();
  f.gateway.listBattleReports.mockResolvedValue({reports: [{...wanted, location_x: 9}], total: 1});
  await f.panel.openListFilteredByGrid(5, 5, 1);
  expect(f.gateway.getBattleReport).not.toHaveBeenCalled(); f.panel.detach();
});
it('same-actor cached target errors stay authoritative without fallback or retry', async () => {
  const f = fixture(); f.panel.openPanel(); await flush();
  f.gateway.listBattleReports.mockResolvedValue({reports: recent, total: 21});
  f.gateway.getBattleReport.mockRejectedValueOnce(new Error('report not found'));
  await f.panel.openListFilteredByGrid(5, 5, 1);
  expect(f.gateway.getBattleReport.mock.calls).toEqual([[1]]);
  expect(f.panel.getRoot().textContent).toContain('report not found');
  expect(f.panel.getReportsSnapshot()).toHaveLength(20); f.panel.detach();
});
it.each(['filter', 'clear', 'close', 'reopen', 'peer', 'relogin'])('newer %s intent wins during grid refresh', async mode => {
  const f = fixture(); f.panel.openPanel(); await flush();
  const resolves: Array<(v: {reports: typeof wanted[]; total: number}) => void> = [];
  f.gateway.listBattleReports.mockImplementation(() => new Promise(ok => { resolves.push(ok); }));
  const pending = f.panel.openListFilteredByGrid(5, 5, 1);
  if (mode === 'filter') f.panel.getRoot().querySelector<HTMLButtonElement>('[data-filter="loss"]')!.click();
  if (mode === 'clear') f.panel.clearLocationFilter();
  if (mode === 'close') f.panel.toggle();
  if (mode === 'reopen') { f.panel.toggle(); f.panel.toggle(); }
  if (mode === 'peer') { const other = document.createElement('div'); other.dataset.centerPanel = 'test-peer'; f.panel.getRoot().parentElement!.append(other); const {openCenterPanel} = await import('./centerPanelForeground'); openCenterPanel(other); }
  if (mode === 'relogin') f.relogin();
  while (resolves.length) { resolves.shift()!({reports: [wanted], total: 1}); await flush(); }
  await pending; await flush();
  expect(f.gateway.getBattleReport.mock.calls.map(c => c[0])).not.toContain(1); f.panel.detach();
});
