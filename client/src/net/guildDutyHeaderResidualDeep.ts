import {
  formatGuildDutyHeaderResidualLine,
  type GuildDutyHeaderResidualInput,
} from "@/net/guildDutyHeaderResidual";
import {
  countGuildMembersOnline,
  formatGuildMemberOnlineSummaryLine,
  formatGuildRoleGroupCountLabel,
  formatGuildRoleGroupHeaderLine,
} from "@/net/socialFormat";

/** CLIENT-265：职务分组头巩固次行 DOM class（与 CLIENT-249 残余行 **并存**）。 */
export const GUILD_DUTY_HEADER_RESIDUAL_DEEP_LINE_CLASS = "guild-duty-header-residual-deep-line";

/**
 * CLIENT-265：职务头（CLIENT-234）+ 职务/在线计数只读巩固次行（CLIENT-249 残余口径 **不退化**；无新 RPC）。
 */
export function formatGuildDutyHeaderResidualDeepLine(input: GuildDutyHeaderResidualInput): string {
  const header = formatGuildRoleGroupHeaderLine(input.label, input.expanded, input.members.length);
  const dutyCount = formatGuildRoleGroupCountLabel(input.members.length);
  const groupOnlineN = countGuildMembersOnline(input.members);
  const parts = [
    header,
    `巩固 职务 ${dutyCount} 人`,
    `本组在线 ${groupOnlineN}/${dutyCount}`,
  ];
  if (input.guildOnlineSummary) {
    parts.push(formatGuildMemberOnlineSummaryLine(input.guildOnlineSummary));
  }
  // 保留 CLIENT-249 残余扫读整行供对照（单测与无障碍扫读不退化）。
  parts.push(formatGuildDutyHeaderResidualLine(input));
  return parts.join(" · ");
}
