import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { HeroMailPanels } from "./HeroMailPanels";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const row = (id: number, status = 1) => ({ mail_id: id, title: `mail ${id}`, body: "system", status, mail_type: 1 });
function deferred() { let resolve!: (v: unknown) => void, reject!: (e: Error) => void; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; }
async function setup() {
  const mount = document.createElement("div"), status = vi.fn(); let generation = 1;
  const session = { serverId: 1, cityId: 1, wallet: {}, bag: [] } as MainCitySession;
  const page = vi.fn().mockResolvedValue({ mails: Array.from({ length: 50 }, (_, i) => row(100 - i)), total_count: 51 });
  const gateway = { getBoundServerId: () => 1, getSessionGeneration: () => generation,
    listPlayerMail: vi.fn((_sid, opts) => opts?.pageSize === 1 ? Promise.resolve({ mails: [], total_count: 0 }) : page(opts)),
    markPlayerMailRead: vi.fn().mockImplementation((_sid, id) => Promise.resolve({ mail: row(id) })), claimPlayerMailAttachments: vi.fn() };
  const panels = new HeroMailPanels(mount, gateway as unknown as GatewayPort, () => session, () => {}, status); panels.attach(); panels.toggleMail(); await flush();
  const click = (action: string) => panels.getMailRoot().querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  const ids = () => [...panels.getMailRoot().querySelectorAll('li[data-mail-id]')].map((el) => Number(el.getAttribute("data-mail-id")));
  return { panels, gateway, page, status, click, ids, relogin: () => { generation++; } };
}
beforeEach(() => sessionStorage.clear());
describe("mail pagination", () => {
  it("loads the inaccessible 51st message with the raw-page offset", async () => {
    const s = await setup(); try {
      expect(s.ids()).toHaveLength(50); s.page.mockResolvedValueOnce({ mails: [row(50)], total_count: 51 });
      expect(s.panels.getMailRoot().querySelector('[data-action="load-more-mail"]')).not.toBeNull();
      s.click("load-more-mail"); await flush(); expect(s.page).toHaveBeenLastCalledWith({ filter: 0, pageSize: 50, pageOffset: 50 });
      expect(s.ids()).toHaveLength(51); expect(s.ids()).toContain(50); expect(s.gateway.claimPlayerMailAttachments).not.toHaveBeenCalled();
    } finally { s.panels.detach(); }
  });  it("preserves selection and de-duplicates pages", async () => {
    const s = await setup(); try {
      s.panels.getMailRoot().querySelector<HTMLElement>('li[data-mail-id="90"]')!.click(); await flush();
      s.page.mockResolvedValueOnce({ mails: [row(51), row(50)], total_count: 52 });
      s.click("load-more-mail"); await flush(); expect(s.ids()).toHaveLength(51);
      expect(s.panels.getMailRoot().querySelector('li.selected')?.getAttribute("data-mail-id")).toBe("90");
      expect(s.panels.getMailRoot().querySelector<HTMLButtonElement>('[data-action="load-more-mail"]')!.hidden).toBe(true);
    } finally { s.panels.detach(); }
  });
  it("coalesces double clicks and retries the same offset after failure", async () => {
    const s = await setup(); try {
      const pending = deferred(); s.page.mockReturnValueOnce(pending.promise); const calls = s.page.mock.calls.length;
      s.click("load-more-mail"); s.click("load-more-mail"); expect(s.page).toHaveBeenCalledTimes(calls + 1);
      pending.reject(new Error("page unavailable")); await flush(); expect(s.ids()).toHaveLength(50);
      s.page.mockResolvedValueOnce({ mails: [row(50)], total_count: 51 }); s.click("load-more-mail"); await flush();
      expect(s.page).toHaveBeenLastCalledWith({ filter: 0, pageSize: 50, pageOffset: 50 }); expect(s.ids()).toHaveLength(51);
    } finally { s.panels.detach(); }
  });
  it("uses raw offsets when local attachment filtering hides all rows", async () => {
    const s = await setup(); try {
      s.click("mail-filter-unclaimed"); await flush(); expect(s.ids()).toEqual([]);
      s.page.mockResolvedValueOnce({ mails: [{ ...row(50), attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] } }], total_count: 51 });
      s.click("load-more-mail"); await flush();
      expect(s.page).toHaveBeenLastCalledWith({ filter: 0, pageSize: 50, pageOffset: 50 }); expect(s.ids()).toEqual([50]);
      expect(s.gateway.claimPlayerMailAttachments).not.toHaveBeenCalled();
    } finally { s.panels.detach(); }
  });
  it.each(["refresh-mail", "mail-filter-unclaimed"])("rejects an old append after %s", async (action) => {
    const s = await setup(); try {
      const pending = deferred(); s.page.mockReturnValueOnce(pending.promise); s.click("load-more-mail");
      s.page.mockResolvedValueOnce({ mails: [], total_count: 0 }); s.click(action); await flush();
      pending.resolve({ mails: [row(50)], total_count: 51 }); await flush(); expect(s.ids()).toEqual([]);
    } finally { s.panels.detach(); }
  });
  it("starts over instead of combining pages across actors", async () => {
    const s = await setup(); try {
      s.relogin(); s.page.mockResolvedValueOnce({ mails: [row(200)], total_count: 1 }); s.click("load-more-mail"); await flush();
      expect(s.page).toHaveBeenLastCalledWith({ filter: 0, pageSize: 50 }); expect(s.ids()).toEqual([200]);
    } finally { s.panels.detach(); }
  });
  it("rejects old responses after detach and reattach", async () => {
    const s = await setup(); try {
      const pending = deferred(); s.page.mockReturnValueOnce(pending.promise); s.click("load-more-mail"); s.panels.detach();
      s.page.mockResolvedValueOnce({ mails: [row(200)], total_count: 1 }); s.panels.attach(); s.panels.toggleMail(); await flush();
      pending.resolve({ mails: [row(50)], total_count: 51 }); await flush(); expect(s.ids()).toEqual([200]);
    } finally { s.panels.detach(); }
  });
  it("stops on an empty page despite a stale total", async () => {
    const s = await setup(); try {
      s.page.mockResolvedValueOnce({ mails: [], total_count: 51 }); s.click("load-more-mail"); await flush();
      expect(s.ids()).toHaveLength(50); expect(s.panels.getMailRoot().querySelector<HTMLButtonElement>('[data-action="load-more-mail"]')!.hidden).toBe(true);
    } finally { s.panels.detach(); }
  });
  it("adjusts unread offset and rejects a pending pre-read page", async () => {
    const s = await setup(); try {
      s.page.mockImplementation((opts) => Promise.resolve({ mails: Array.from({ length: 50 }, (_, i) => row(100 - i, opts.filter === 1 ? 0 : 1)), total_count: 51 }));
      s.click("mail-filter-unread"); await flush();
      const pending = deferred(); s.page.mockReturnValueOnce(pending.promise); s.click("load-more-mail");
      s.panels.getMailRoot().querySelector<HTMLElement>('li[data-mail-id="90"]')!.click(); await flush();
      pending.resolve({ mails: [row(49, 0)], total_count: 50 }); await flush(); expect(s.ids()).not.toContain(49); expect(s.ids()).not.toContain(90);
      s.page.mockResolvedValueOnce({ mails: [row(50, 0)], total_count: 50 }); s.click("load-more-mail"); await flush();
      expect(s.page).toHaveBeenCalledWith({ filter: 1, pageSize: 50, pageOffset: 49 }); expect(s.ids()).toContain(50); expect(s.ids()).not.toContain(90);
    } finally { s.panels.detach(); }
  });
});
describe('claim pagination regressions', () => {
  it('adjusts unread offset after claim so the next unread row is not skipped', async () => {
    const s = await setup(); try {
      s.page.mockImplementation((opts) => Promise.resolve({ mails: Array.from({ length: 50 }, (_, i) => ({...row(100-i, opts.filter === 1 ? 0 : 1), attachments:{items:[{item_cfg_id:2001,quantity:1}]}})), total_count:51 }));
      s.click('mail-filter-unread'); await flush();
      s.gateway.claimPlayerMailAttachments.mockResolvedValueOnce({mail:row(100,2), granted:{}});
      s.click('claim-mail'); await flush();
      expect(s.ids()).not.toContain(100);
      s.page.mockResolvedValueOnce({mails:[row(50,0)],total_count:50});
      s.click('load-more-mail'); await flush();
      expect(s.page).toHaveBeenCalledWith({filter:1,pageSize:50,pageOffset:49});
      expect(s.ids()).not.toContain(100);
    } finally { s.panels.detach(); }
  });
  it('does not resurrect a claimed attachment on append in the attachment tab', async () => {
    const s = await setup(); try {
      s.page.mockResolvedValueOnce({mails:Array.from({length:50},(_,i)=>({...row(100-i),attachments:{items:[{item_cfg_id:2001,quantity:1}]}})),total_count:51});
      s.click('mail-filter-unclaimed'); await flush();
      s.gateway.claimPlayerMailAttachments.mockResolvedValueOnce({mail:row(100,2),granted:{}});
      s.click('claim-mail'); await flush();
      expect(s.ids()).not.toContain(100);
      s.page.mockResolvedValueOnce({mails:[row(50)],total_count:51});
      s.click('load-more-mail'); await flush();
      expect(s.ids()).not.toContain(100);
    } finally { s.panels.detach(); }
  });
});
