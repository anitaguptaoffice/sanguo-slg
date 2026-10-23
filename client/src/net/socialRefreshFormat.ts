import { gatewayErrorMessage } from "@/net/contentFeedback";
import { formatSocialPanelStaleDataLabel } from "@/net/socialFormat";

/** 社交面板「上次更新」本地时间戳（CLIENT-045）。 */
export function formatSocialPanelLastUpdated(atMs: number): string {
  const d = new Date(atMs);
  return `上次更新：${d.toLocaleString("zh-CN", { hour12: false })}`;
}

export function formatSocialPanelRefreshError(message: string): string {
  return `刷新失败：${message}`;
}

/** 刷新失败行内文案：保留网关 `[code] msg`（CLIENT-076）。 */
export function formatSocialPanelRefreshFailure(err: unknown): string {
  return formatSocialPanelRefreshError(gatewayErrorMessage(err));
}

/** 成功刷新后的状态行；stale 时追加 CLIENT-053 陈旧标注。 */
export function formatSocialPanelLastUpdatedLine(atMs: number, stale = false): string {
  const base = formatSocialPanelLastUpdated(atMs);
  if (!stale) return base;
  return `${base} · ${formatSocialPanelStaleDataLabel()}`;
}

export const SOCIAL_PANEL_REFRESH_BUSY_LABEL = "刷新中…";

export type PanelRefreshMetaInput = {
  busy: boolean;
  lastUpdatedMs: number;
  error: string | null;
  stale?: boolean;
};

export type PanelRefreshMeta = {
  statusText: string;
  statusHidden: boolean;
  isError: boolean;
  isStale: boolean;
  spinnerVisible: boolean;
  retryVisible: boolean;
};

/** 排行/军团/聊天三面板刷新状态行（CLIENT-045 + CLIENT-076）。 */
export function formatPanelRefreshMeta(input: PanelRefreshMetaInput): PanelRefreshMeta {
  const stale = input.stale ?? false;
  if (input.busy) {
    return {
      statusText: SOCIAL_PANEL_REFRESH_BUSY_LABEL,
      statusHidden: false,
      isError: false,
      isStale: stale,
      spinnerVisible: true,
      retryVisible: false,
    };
  }
  if (input.error) {
    let statusText = formatSocialPanelRefreshError(input.error);
    if (stale) statusText += ` · ${formatSocialPanelStaleDataLabel()}`;
    return {
      statusText,
      statusHidden: false,
      isError: true,
      isStale: stale,
      spinnerVisible: false,
      retryVisible: true,
    };
  }
  if (input.lastUpdatedMs > 0) {
    return {
      statusText: formatSocialPanelLastUpdatedLine(input.lastUpdatedMs, stale),
      statusHidden: false,
      isError: false,
      isStale: stale,
      spinnerVisible: false,
      retryVisible: false,
    };
  }
  return {
    statusText: "",
    statusHidden: true,
    isError: false,
    isStale: false,
    spinnerVisible: false,
    retryVisible: false,
  };
}
