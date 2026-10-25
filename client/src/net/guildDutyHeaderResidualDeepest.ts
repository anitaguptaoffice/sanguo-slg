import { type GuildDutyHeaderResidualInput } from "@/net/guildDutyHeaderResidual";
import { formatGuildDutyHeaderResidualDeeperLine } from "@/net/guildDutyHeaderResidualDeeper";
import {
  countGuildMembersOnline,
  formatGuildMemberOnlineSummaryLine,
  formatGuildRoleGroupCountLabel,
  formatGuildRoleGroupHeaderLine,
} from "@/net/socialFormat";

/** CLIENT-297：职务分组头巩固再加深一层第三行 DOM class（与 CLIENT-281 更深行 **并存**）。 */
export const GUILD_DUTY_HEADER_RESIDUAL_DEEPEST_LINE_CLASS =
  "guild-duty-header-residual-deepest-line";

/**
 * CLIENT-297：职务头（CLIENT-234）+ 职务/在线计数只读巩固再加深一层第三行（CLIENT-281 更深行 **不退化**；无新 RPC）。
 */
export function formatGuildDutyHeaderResidualDeepestLine(
  input: GuildDutyHeaderResidualInput,
): string {
  const header = formatGuildRoleGroupHeaderLine(input.label, input.expanded, input.members.length);
  const dutyCount = formatGuildRoleGroupCountLabel(input.members.length);
  const groupOnlineN = countGuildMembersOnline(input.members);
  const parts = [
    header,
    `巩固再加深一层 职务 ${dutyCount} 人`,
    `本组在线 ${groupOnlineN}/${dutyCount}`,
  ];
  if (input.guildOnlineSummary) {
    parts.push(formatGuildMemberOnlineSummaryLine(input.guildOnlineSummary));
  }
  parts.push(formatGuildDutyHeaderResidualDeeperLine(input));
  return parts.join(" · ");
}
