import { type GuildDutyHeaderResidualInput } from "@/net/guildDutyHeaderResidual";
import { formatGuildDutyHeaderResidualDeepestDeeperLine } from "@/net/guildDutyHeaderResidualDeepestDeeper";
import {
  countGuildMembersOnline,
  formatGuildMemberOnlineSummaryLine,
  formatGuildRoleGroupCountLabel,
  formatGuildRoleGroupHeaderLine,
} from "@/net/socialFormat";

/** CLIENT-329：职务分组头巩固再加深三层第四行 DOM class（与 CLIENT-313 更深二层行 **并存**）。 */
export const GUILD_DUTY_HEADER_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_CLASS =
  "guild-duty-header-residual-deepest-deepest-deeper-line";

/**
 * CLIENT-329：职务头（CLIENT-234）+ 职务/在线计数只读巩固再加深三层第四行（CLIENT-313 更深二层行 **不退化**；无新 RPC）。
 */
export function formatGuildDutyHeaderResidualDeepestDeepestDeeperLine(
  input: GuildDutyHeaderResidualInput,
): string {
  const header = formatGuildRoleGroupHeaderLine(input.label, input.expanded, input.members.length);
  const dutyCount = formatGuildRoleGroupCountLabel(input.members.length);
  const groupOnlineN = countGuildMembersOnline(input.members);
  const parts = [
    header,
    `巩固再加深三层 职务 ${dutyCount} 人`,
    `本组在线 ${groupOnlineN}/${dutyCount}`,
  ];
  if (input.guildOnlineSummary) {
    parts.push(formatGuildMemberOnlineSummaryLine(input.guildOnlineSummary));
  }
  parts.push(formatGuildDutyHeaderResidualDeepestDeeperLine(input));
  return parts.join(" · ");
}
