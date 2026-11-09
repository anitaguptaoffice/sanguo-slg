import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { getProtoRoot } from "@/net/loadProto";
import { decodeGatewayResponse } from "@/net/decodeGatewayResponse";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { SocialPanels } from "./SocialPanels";

const panels: SocialPanels[] = [];
const styles: HTMLStyleElement[] = [];
afterEach(() => {
  panels.splice(0).forEach(panel => panel.detach());
  styles.splice(0).forEach(style => style.remove());
  document.body.replaceChildren();
  sessionStorage.clear();
  vi.restoreAllMocks();
});
function wire(name: string, value: object) {
  const type = getProtoRoot().lookupType(`sanguo.guild.v1.${name}`);
  return decodeGatewayResponse(type, type.encode(type.fromObject(value)).finish());
}
async function mountGuild(narrow = false) {
  const mount = document.createElement("div");
  mount.id = "layout-frame";
  if (narrow) mount.classList.add("layout-narrow");
  const trigger = document.createElement("button");
  trigger.textContent = "军团";
  document.body.append(trigger, mount);
  const guild = { guild_id: 7, server_id: 1, name: "测试军团", member_count: 2 };
  const gateway = {
    getBoundServerId: () => 1, getSessionGeneration: () => 1,
    createGuild: vi.fn(async () => wire("CreateGuildResponse", { guild })),
    listGuildMembers: vi.fn(async () => wire("ListGuildMembersResponse", {
      guild, total_count: 2, members: [
        { player_id: 1, display_name: "甲", role: 1 },
        { player_id: 2, display_name: "乙", role: 3 },
      ],
    })),
  };
  const session = { serverId: 1, cityId: 1 } as MainCitySession;
  const panel = new SocialPanels(mount, gateway as unknown as GatewayPort, () => session, () => {});
  panels.push(panel);
  panel.attach();
  trigger.addEventListener("click", () => panel.toggleGuild());
  trigger.focus();
  trigger.click();
  mount.querySelector<HTMLInputElement>('[data-field="guild-name"]')!.value = guild.name;
  mount.querySelector<HTMLButtonElement>('[data-action="create-guild"]')!.click();
  await vi.waitFor(() => expect(mount.querySelectorAll('[data-action="toggle-guild-role-group"]')).toHaveLength(2));
  const root = mount.querySelector<HTMLElement>('[data-center-panel="guild"]')!;
  const toggle = (role: number) => root.querySelector<HTMLButtonElement>(`[data-action="toggle-guild-role-group"][data-role-key="${role}"]`)!;
  return { mount, trigger, root, toggle, gateway };
}

it.each([1, 3])("keeps focused role %s through repeated native button activation and Escape", async role => {
  const { root, trigger, toggle, gateway } = await mountGuild();
  let button = toggle(role);
  button.focus();
  const initial = button.getAttribute("aria-expanded");
  const focus = vi.spyOn(HTMLElement.prototype, "focus");
  for (let i = 0; i < 4; i++) {
    const old = button;
    // JSDOM does not implement Enter's native click default. Exercise its real click handler;
    // official Chromium separately proves trusted keyboard activation and visible focus.
    button.click();
    button = toggle(role);
    expect(button).not.toBe(old);
    expect(old.isConnected).toBe(false);
    expect(document.activeElement).toBe(button);
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(button.getAttribute("aria-expanded")).toBe(i % 2 ? initial : String(initial !== "true"));
  }
  document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  expect(root.classList.contains("hidden")).toBe(true);
  expect(document.activeElement).toBe(trigger);
  expect(gateway.listGuildMembers).toHaveBeenCalledTimes(1);
  trigger.click();
  await Promise.resolve();
  expect(root.classList.contains("hidden")).toBe(false);
  expect(root.querySelectorAll(".guild-member-row")).toHaveLength(0);
  expect(gateway.listGuildMembers).toHaveBeenCalledTimes(1);
  root.querySelector<HTMLButtonElement>('[data-action="refresh-members"]')!.click();
  await vi.waitFor(() => expect(gateway.listGuildMembers).toHaveBeenCalledTimes(2));
  expect(toggle(role).getAttribute("aria-expanded")).toBe(initial);
});

it("does not steal unrelated focus when an unfocused toggle receives a click", async () => {
  const { trigger, toggle } = await mountGuild();
  trigger.focus();
  toggle(1).click();
  expect(document.activeElement).toBe(trigger);
});

it.each([false, true])("backs summary text locally rather than inheriting artwork contrast, narrow=%s", async narrow => {
  const style = document.createElement("style");
  style.textContent = readFileSync("index.html", "utf8").match(/<style>([\s\S]*?)<\/style>/)![1];
  document.head.append(style);
  styles.push(style);
  const { root } = await mountGuild(narrow);
  const summary = root.querySelector<HTMLElement>('[data-role="guild-member-online-summary"]')!;
  const computed = getComputedStyle(summary);
  expect(computed.backgroundColor).toBe("rgb(36, 23, 15)");
  expect(computed.color).toBe("rgb(255, 243, 214)");
  expect(computed.backgroundImage).toBe("none");
  expect(computed.opacity).toBe("1");
  expect(summary.classList.contains("hidden")).toBe(false);
  expect(summary.textContent).toContain("共 2 人");
});
