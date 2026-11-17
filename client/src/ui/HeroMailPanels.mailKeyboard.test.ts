import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import type { MailRow } from "@/net/heroMailState";
import { MAIL_INBOX_FILTER_SESSION_KEY } from "@/net/mailInboxFilter";
let panels: HeroMailPanels;
let mount: HTMLElement;
let rows: MailRow[];
let mark: ReturnType<typeof vi.fn>;
let claim: ReturnType<typeof vi.fn>;
let finishRead: ((value: unknown) => void) | undefined;
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const button = (id: number) => mount.querySelector<HTMLButtonElement>(`[data-mail-id="${id}"] [data-role="mail-open"]`)!;
const body = () => mount.querySelector('[data-role="mail-body"]')?.textContent;
const action = (name: string) => mount.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!;
async function setup(unread = false) {
  sessionStorage.clear();
  if (unread) sessionStorage.setItem(MAIL_INBOX_FILTER_SESSION_KEY, "1");
  mount = document.createElement("div"); document.body.append(mount);
  rows = [20, 19, 18].map(id => ({ mail_id: id, title: `Notice ${id}`, body: `Body ${id}`, status: 0, mail_type: 1 }));
  rows[2].attachments = { items: [{ item_cfg_id: 2001, quantity: 1 }] };
  mark = vi.fn((_sid, _id) => new Promise(resolve => { finishRead = resolve; }));
  claim = vi.fn();
  const gateway = { getBoundServerId: () => 1,
    listPlayerMail: vi.fn(async () => ({ mails: rows, total_count: rows.length })),
    markPlayerMailRead: mark, claimPlayerMailAttachments: claim,
  } as unknown as GatewayPort;
  const session = { serverId: 1, cityId: 1, cityName: "City", wallet: {}, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
  panels = new HeroMailPanels(mount, gateway, () => session, () => {}, () => {});
  panels.attach(); panels.toggleMail(); await tick();
}
async function resolveRead(id: number) {
  finishRead!({ mail: { ...rows.find(row => row.mail_id === id), status: 1, read_at_ms: 1 } });
  await tick();
}
beforeEach(() => { finishRead = undefined; });
afterEach(() => { panels?.detach(); mount?.remove(); sessionStorage.clear(); });
it("exposes each loaded message as a native button without nested checkbox or automatic read", async () => {
  await setup();
  expect(body()).toBe("Body 20");
  for (const id of [20, 19, 18]) {
    expect(button(id)).toBeInstanceOf(HTMLButtonElement);
    expect(button(id).type).toBe("button");
    expect(button(id).textContent).toContain(`Notice ${id}`);
    button(id).focus(); expect(document.activeElement).toBe(button(id));
    expect(button(id).querySelector("input")).toBeNull();
  }
  expect(mark).not.toHaveBeenCalled(); expect(claim).not.toHaveBeenCalled();
});
it("uses existing click activation and preserves the focused message through both read rerenders", async () => {
  await setup(); button(19).focus(); button(19).click();
  expect(body()).toBe("Body 19"); expect(document.activeElement).toBe(button(19));
  expect(mark).toHaveBeenCalledExactlyOnceWith(1, 19);
  await resolveRead(19);
  expect(document.activeElement).toBe(button(19)); expect(body()).toBe("Body 19");
  expect(claim).not.toHaveBeenCalled();
});
it("does not install a synthetic keydown activation path (native browser activation is a separate gate)", async () => {
  await setup(); button(19).focus();
  for (const key of ["Enter", " "]) button(19).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  expect(mark).not.toHaveBeenCalled(); expect(body()).toBe("Body 20");
});
it("does not steal newer toolbar focus when read completes", async () => {
  await setup(); button(19).focus(); button(19).click(); action("refresh-mail").focus();
  await resolveRead(19); expect(document.activeElement).toBe(action("refresh-mail"));
});
it("preserves a newer message focus when another read completes", async () => {
  await setup(); button(19).focus(); button(19).click(); button(18).focus();
  await resolveRead(19); expect(document.activeElement).toBe(button(18));
  expect(mark).toHaveBeenCalledTimes(1);
});
it("checkbox selection stays separate from message activation and survives a read rerender", async () => {
  await setup(); button(19).focus(); button(19).click();
  const checkbox = mount.querySelector<HTMLInputElement>('[data-mail-id="18"] input')!;
  checkbox.focus(); checkbox.click();
  expect(checkbox.checked).toBe(true); expect(body()).toBe("Body 19");
  expect(mark).toHaveBeenCalledTimes(1); expect(claim).not.toHaveBeenCalled();
  await resolveRead(19);
  const next = mount.querySelector<HTMLInputElement>('[data-mail-id="18"] input')!;
  expect(next.checked).toBe(true); expect(document.activeElement).toBe(next);
});
it("unread removal focuses the next surviving row without marking it read", async () => {
  await setup(true); button(19).focus(); button(19).click(); await resolveRead(19);
  expect(button(19)).toBeNull(); expect(document.activeElement).toBe(button(18));
  expect(mark).toHaveBeenCalledTimes(1); expect(claim).not.toHaveBeenCalled();
});
it("empty unread removal focuses the existing unread filter", async () => {
  await setup(true); rows.splice(1); action("refresh-mail").click(); await tick();
  button(20).focus(); button(20).click(); await resolveRead(20);
  expect(mount.querySelector('[data-role="mail-open"]')).toBeNull();
  expect(document.activeElement).toBe(action("mail-filter-unread"));
  expect(mark).toHaveBeenCalledTimes(1); expect(claim).not.toHaveBeenCalled();
});
it("read failure retains focus and does not issue a retry or claim", async () => {
  await setup(); mark.mockRejectedValueOnce(new Error("Read unavailable"));
  button(19).focus(); button(19).click(); await tick();
  expect(document.activeElement).toBe(button(19)); expect(body()).toBe("Body 19");
  expect(mark).toHaveBeenCalledTimes(1); expect(claim).not.toHaveBeenCalled();
});
it("pointer row activation does not move unrelated focus into the mailbox", async () => {
  await setup(); action("refresh-mail").focus();
  (mount.querySelector('[data-mail-id="19"] .mail-row-summary') as HTMLElement).click();
  await resolveRead(19);
  expect(body()).toBe("Body 19"); expect(document.activeElement).toBe(action("refresh-mail"));
});
