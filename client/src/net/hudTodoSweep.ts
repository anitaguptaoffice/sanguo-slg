/**
 * HUD 待办角标：邮件未领附件 + 日常可领计数合并扫读（CLIENT-162 中心待办与底栏 title 同源）。
 */
export function formatHudTodoSweepLine(input: {
  mailClaimable: number;
  dailyClaimable: number;
}): string | null {
  const parts: string[] = [];
  const mail = Math.max(0, input.mailClaimable);
  const daily = Math.max(0, input.dailyClaimable);
  if (mail > 0) parts.push(`邮件附件 ${mail}`);
  if (daily > 0) parts.push(`日常可领 ${daily}`);
  return parts.length ? parts.join(" · ") : null;
}
