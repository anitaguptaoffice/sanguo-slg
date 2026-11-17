import { afterEach, expect, it, vi } from "vitest";
import { getProtoRoot } from "./loadProto";
import { decodeGatewayResponse } from "./decodeGatewayResponse";
import { countGuildMembersOnline, formatGuildMemberOnlineSummaryLine, type GuildMemberRow } from "./socialFormat";
import { formatGuildDutyHeaderResidualDeepestDeepestDeepestDeepestDeeperLine as formatDeepest } from "./guildDutyHeaderResidualDeepestDeepestDeepestDeepestDeeper";
import { SocialPanels } from "@/ui/SocialPanels";
import type { GatewayPort } from "./GatewayClient";
import type { MainCitySession } from "./bootstrapSession";

function wire(name: string, value: object) {
  const type = getProtoRoot().lookupType(`sanguo.guild.v1.${name}`);
  return decodeGatewayResponse(type, type.encode(type.fromObject(value)).finish());
}
const guild = { guild_id: 7, name: "测试军团", member_count: 2 };
function listResponse() {
  return wire("ListGuildMembersResponse", { guild, total_count: 2, members: [
    { player_id: 1, display_name: "甲", role: 1 },
    { player_id: 2, display_name: "乙", role: 3 },
  ] }) as { members: GuildMemberRow[]; total_count: number };
}
const panels: SocialPanels[] = [];
afterEach(() => {
  panels.splice(0).forEach(panel => panel.detach());
  document.body.replaceChildren();
  sessionStorage.clear();
});

it("production guild protobuf has no presence fields and must not imply offline", () => {
  const response = listResponse();
  expect(response.members).toHaveLength(2);
  for (const member of response.members) expect(member).not.toHaveProperty("is_online");
  expect(response).not.toHaveProperty("online_count");
  expect(formatGuildMemberOnlineSummaryLine({ members: response.members, totalCount: response.total_count }))
    .toBe("在线未知 / 共 2 人");
  const line = formatDeepest({ label: "成员", expanded: true, members: response.members });
  expect(line.match(/本组在线 未知\/2/g)).toHaveLength(8);
  expect(line).not.toMatch(/在线 0/);
  expect(line).toContain("▼ 成员 · 2 人");
});

it.each([
  { members: [{}], total: 1, online: undefined, text: "未知" },
  { members: [{ is_online: true }, {}], total: 2, online: undefined, text: "未知" },
  { members: [{ is_online: false }, {}], total: 2, online: undefined, text: "未知" },
  { members: [{ is_online: false }], total: 1, online: 0, text: " 0" },
  { members: [{ is_online: true }, { is_online: false }], total: 2, online: 1, text: " 1" },
  { members: [{ is_online: false }], total: 2, online: 0, text: "未知" },
  { members: [], total: 2, online: 0, text: "未知" },
  { members: [], total: 0, online: 0, text: " 0" },
])("presence knowledge: $text with total $total", ({ members, total, online, text }) => {
  expect(countGuildMembersOnline(members)).toBe(online);
  expect(formatGuildMemberOnlineSummaryLine({ members, totalCount: total })).toBe(`在线${text} / 共 ${total} 人`);
  const groupText = online === undefined ? "未知" : String(online);
  const line = formatDeepest({ label: "成员", expanded: false, members });
  expect(line.split(`本组在线 ${groupText}/${members.length}`)).toHaveLength(9);
});

it("an explicit complete count keeps authoritative zero even with unknown members", () => {
  expect(formatGuildMemberOnlineSummaryLine({ members: [{}], totalCount: 5, onlineCount: 0 }))
    .toBe("在线 0 / 共 5 人");
});

it("actual mounted join and refresh path renders decoded unknown presence without changing role counts", async () => {
  const mount = document.createElement("div");
  document.body.append(mount);
  const session = { serverId: 1, cityId: 1 } as MainCitySession;
  const gateway = {
    getBoundServerId: () => 1, getSessionGeneration: () => 1,
    joinGuild: vi.fn(async () => wire("JoinGuildResponse", { guild })),
    listGuildMembers: vi.fn(async () => listResponse()),
  };
  const panel = new SocialPanels(mount, gateway as unknown as GatewayPort, () => session, () => {});
  panels.push(panel);
  panel.attach();
  panel.toggleGuild();
  mount.querySelector<HTMLInputElement>('[data-field="join-guild-id"]')!.value = "7";
  mount.querySelector<HTMLButtonElement>('[data-action="join-guild"]')!.click();
  await vi.waitFor(() => expect(gateway.listGuildMembers).toHaveBeenCalledWith(1, 7, 1));
  expect(mount.querySelector('[data-role="guild-member-online-summary"]')!.textContent)
    .toBe("在线未知 / 共 2 人");
  const headers = mount.querySelectorAll('[data-role="guild-role-group-header-line"]');
  expect(headers).toHaveLength(2);
  for (const header of headers) {
    expect(header.textContent!.match(/本组在线 未知\/1/g)).toHaveLength(8);
    expect(header.textContent).toContain("在线未知 / 共 2 人");
    expect(header.textContent).not.toMatch(/在线 0/);
  }
  expect([...mount.querySelectorAll('[data-role="guild-role-group-count"]')].map(el => el.textContent))
    .toEqual(["1", "1"]);
  mount.querySelector<HTMLButtonElement>('[data-action="toggle-guild-role-group"][aria-expanded="false"]')!.click();
  expect(mount.querySelectorAll(".guild-member-row")).toHaveLength(2);
});

it.each([-1, 0.5, Infinity, NaN, 3])("invalid online hint %s cannot manufacture a known count", onlineCount => {
  expect(formatGuildMemberOnlineSummaryLine({ members: [{}], totalCount: 2, onlineCount }))
    .toBe("在线未知 / 共 2 人");
});
