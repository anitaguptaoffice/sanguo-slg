import type { GuildMemberRow } from "@/net/socialFormat";
import {
  formatGuildMemberOnlineSummaryLine,
  formatGuildRoleGroupHeaderLine,
  type GuildMemberOnlineSummaryInput,
} from "@/net/socialFormat";

/** CLIENT-249：职务分组头下只读残余次行（`data-role` 与 wave:40 manifest 一致）。 */
export const GUILD_ROLE_GROUP_HEADER_LINE_ROLE = "guild-role-group-header-line";
export const GUILD_ROLE_GROUP_HEADER_RESIDUAL_CLASS = "guild-role-group-header-residual-line";

export type GuildDutyHeaderResidualInput = {
  label: string;
  expanded: boolean;
  members: GuildMemberRow[];
  /** 军团列表头在线摘要（CLIENT-217）；与本职务成员同源字段，无新 RPC。 */
  guildOnlineSummary?: GuildMemberOnlineSummaryInput;
};

/**
 * CLIENT-249：职务分组头（CLIENT-234）+ 本组/军团在线摘要（CLIENT-217）只读残余次行。
 */
export function formatGuildDutyHeaderResidualLine(input: GuildDutyHeaderResidualInput): string {
  const header = formatGuildRoleGroupHeaderLine(input.label, input.expanded, input.members.length);
  const groupSummary = formatGuildMemberOnlineSummaryLine({ members: input.members });
  const parts = [header, groupSummary];
  if (input.guildOnlineSummary) {
    parts.push(formatGuildMemberOnlineSummaryLine(input.guildOnlineSummary));
  }
  return parts.join(" · ");
}
