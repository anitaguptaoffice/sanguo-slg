import { MINIMAP_INTEL_SYNC_RING_CLASS } from "@/ui/minimapIntelSyncHighlight";
import {
  scrollIntelRowIntoMarchPanelBody,
  syncMinimapViewportToIntelRow,
  type BeginMinimapViewportIntelSyncRingOptions,
  type MinimapViewportIntelSyncTimers,
  type SyncMinimapViewportToIntelRowInput,
  type SyncMinimapViewportToIntelRowResult,
} from "@/net/minimapViewportIntelSync";

/** 军情行变更 → 视口 scroll-sync 残余深环（CLIENT-252；叠 CLIENT-236 viewport ring）。 */
export const MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS =
  "minimap-intel-scroll-sync-deep-ring";

export const MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_MS = 1200;

export type MinimapViewportIntelScrollResidualTimers = {
  deepRingClassTimer: ReturnType<typeof setTimeout> | null;
};

export function createMinimapViewportIntelScrollResidualTimers(): MinimapViewportIntelScrollResidualTimers {
  return { deepRingClassTimer: null };
}

export type SyncMinimapViewportIntelScrollResidualInput = SyncMinimapViewportToIntelRowInput & {
  intelRoot: ParentNode | null | undefined;
};

export type SyncMinimapViewportIntelScrollResidualOptions =
  BeginMinimapViewportIntelSyncRingOptions & {
    storage?: Pick<Storage, "setItem"> | null;
    viewportTimers?: MinimapViewportIntelSyncTimers;
    residualTimers?: MinimapViewportIntelScrollResidualTimers;
  };

function clearMinimapIntelScrollSyncDeepRing(
  layoutFrame: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  marchId: number | null,
): void {
  layoutFrame?.classList.remove(MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS);
  if (intelRoot != null && marchId != null && marchId > 0) {
    intelRoot
      .querySelector<HTMLElement>(
        `.march-list li[data-march-id="${Math.trunc(marchId)}"].${MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS}`,
      )
      ?.classList.remove(MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS);
  }
}

export type BeginMinimapIntelScrollSyncDeepRingOptions = {
  durationMs?: number;
  timers?: MinimapViewportIntelScrollResidualTimers;
  marchId?: number | null;
};

/** 在 CLIENT-236 视口锚点与列表滚入之后叠加 deep ring（不摘除 CLIENT-220 sync ring）。 */
export function beginMinimapIntelScrollSyncDeepRing(
  layoutFrame: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  options?: BeginMinimapIntelScrollSyncDeepRingOptions,
): void {
  const duration = options?.durationMs ?? MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_MS;
  const timers = options?.timers;
  const marchId =
    options?.marchId != null && Number.isFinite(options.marchId) && options.marchId > 0
      ? Math.trunc(options.marchId)
      : null;

  if (timers?.deepRingClassTimer) {
    clearTimeout(timers.deepRingClassTimer);
    timers.deepRingClassTimer = null;
  }
  clearMinimapIntelScrollSyncDeepRing(layoutFrame, intelRoot, marchId);
  if (!layoutFrame && !intelRoot) return;

  if (layoutFrame) {
    layoutFrame.classList.add(MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS);
    void layoutFrame.offsetWidth;
    if (layoutFrame.classList.contains(MINIMAP_INTEL_SYNC_RING_CLASS)) {
      /* CLIENT-220 双向环须并存 */
    }
  }
  if (intelRoot && marchId != null) {
    const row = intelRoot.querySelector<HTMLElement>(
      `.march-list li[data-march-id="${marchId}"]`,
    );
    row?.classList.add(MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS);
    void row?.offsetWidth;
  }

  if (timers && duration > 0) {
    timers.deepRingClassTimer = setTimeout(() => {
      timers.deepRingClassTimer = null;
      clearMinimapIntelScrollSyncDeepRing(layoutFrame, intelRoot, marchId);
    }, duration);
  }
}

/**
 * 军情行变更：CLIENT-236 视口锚点 + 列表滚入 + scroll-sync deep ring 1.2s（CLIENT-252）。
 */
export function syncMinimapViewportIntelScrollResidual(
  input: SyncMinimapViewportIntelScrollResidualInput,
  options?: SyncMinimapViewportIntelScrollResidualOptions,
): SyncMinimapViewportToIntelRowResult {
  const viewportResult = syncMinimapViewportToIntelRow(
    {
      march: input.march,
      bounds: input.bounds,
      currentView: input.currentView,
      layoutFrame: input.layoutFrame,
      minZoom: input.minZoom,
    },
    {
      durationMs: options?.durationMs,
      timers: options?.viewportTimers,
      storage: options?.storage,
    },
  );

  const march = input.march;
  const marchId = march?.march_id;
  if (viewportResult.applied && marchId != null && Number.isFinite(marchId) && marchId > 0) {
    scrollIntelRowIntoMarchPanelBody(input.intelRoot, Math.trunc(marchId));
    beginMinimapIntelScrollSyncDeepRing(input.layoutFrame, input.intelRoot, {
      durationMs: options?.durationMs ?? MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_MS,
      timers: options?.residualTimers,
      marchId: Math.trunc(marchId),
    });
  }

  return viewportResult;
}

/** @internal vitest */
export function resetMinimapViewportIntelScrollResidualTimersForTests(
  timers: MinimapViewportIntelScrollResidualTimers,
): void {
  if (timers.deepRingClassTimer) {
    clearTimeout(timers.deepRingClassTimer);
    timers.deepRingClassTimer = null;
  }
}
