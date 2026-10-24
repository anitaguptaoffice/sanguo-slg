import { type GuildDutyHeaderResidualInput } from "@/net/guildDutyHeaderResidual";
import { formatGuildDutyHeaderResidualDeepLine } from "@/net/guildDutyHeaderResidualDeep";
import {
  countGuildMembersOnline,
  formatGuildMemberOnlineSummaryLine,
  formatGuildRoleGroupCountLabel,
  formatGuildRoleGroupHeaderLine,
} from "@/net/socialFormat";

/** CLIENT-281：职务分组头巩固再加深第三行 DOM class（与 CLIENT-265 深行 **并存**）。 */
export const GUILD_DUTY_HEADER_RESIDUAL_DEEPER_LINE_CLASS =
  "guild-duty-header-residual-deeper-line";

/**
 * CLIENT-281：职务头（CLIENT-234）+ 职务/在线计数只读巩固再加深第三行（CLIENT-265 深行 **不退化**；无新 RPC）。
 */
export function formatGuildDutyHeaderResidualDeeperLine(
  input: GuildDutyHeaderResidualInput,
): string {
  const header = formatGuildRoleGroupHeaderLine(input.label, input.expanded, input.members.length);
  const dutyCount = formatGuildRoleGroupCountLabel(input.members.length);
  const groupOnlineN = countGuildMembersOnline(input.members);
  const parts = [
    header,
    `巩固再加深 职务 ${dutyCount} 人`,
    `本组在线 ${groupOnlineN}/${dutyCount}`,
  ];
  if (input.guildOnlineSummary) {
    parts.push(formatGuildMemberOnlineSummaryLine(input.guildOnlineSummary));
  }
  parts.push(formatGuildDutyHeaderResidualDeepLine(input));
  return parts.join(" · ");
}
