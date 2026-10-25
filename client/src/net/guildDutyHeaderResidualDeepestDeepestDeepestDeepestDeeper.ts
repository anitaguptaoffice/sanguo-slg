import { type GuildDutyHeaderResidualInput } from "@/net/guildDutyHeaderResidual";
import { formatGuildDutyHeaderResidualDeepestDeepestDeepestDeeperLine } from "@/net/guildDutyHeaderResidualDeepestDeepestDeepestDeeper";
import {
  countGuildMembersOnline,
  formatGuildMemberOnlineSummaryLine,
  formatGuildRoleGroupCountLabel,
  formatGuildRoleGroupHeaderLine,
} from "@/net/socialFormat";

/** CLIENT-377：职务分组头 wave:58 巩固再加深五层第四行 DOM class（与 CLIENT-361 更深五层行 **并存**）。 */
export const GUILD_DUTY_HEADER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_CLASS =
  "guild-duty-header-residual-deepest-deepest-deepest-deepest-deeper-line";

/**
 * CLIENT-377：职务头（CLIENT-234）+ 职务/在线计数只读 wave:58 巩固再加深五层第四行（CLIENT-361 **不退化**；无新 RPC）。
 */
export function formatGuildDutyHeaderResidualDeepestDeepestDeepestDeepestDeeperLine(
  input: GuildDutyHeaderResidualInput,
): string {
  const header = formatGuildRoleGroupHeaderLine(input.label, input.expanded, input.members.length);
  const dutyCount = formatGuildRoleGroupCountLabel(input.members.length);
  const groupOnlineN = countGuildMembersOnline(input.members);
  const parts = [
    header,
    `巩固再加深五层 职务 ${dutyCount} 人`,
    `本组在线 ${groupOnlineN}/${dutyCount}`,
  ];
  if (input.guildOnlineSummary) {
    parts.push(formatGuildMemberOnlineSummaryLine(input.guildOnlineSummary));
  }
  parts.push(formatGuildDutyHeaderResidualDeepestDeepestDeepestDeeperLine(input));
  return parts.join(" · ");
}
