import {
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS,
  syncMinimapViewportIntelScrollResidualDeep,
  type MinimapViewportIntelScrollResidualDeepTimers,
  type SyncMinimapViewportIntelScrollResidualDeepOptions,
} from "@/net/minimapViewportIntelScrollResidualDeep";
import type { SyncMinimapViewportIntelScrollResidualInput } from "@/net/minimapViewportIntelScrollResidual";
import { MINIMAP_INTEL_SYNC_RING_CLASS } from "@/ui/minimapIntelSyncHighlight";
import type { SyncMinimapViewportToIntelRowResult } from "@/net/minimapViewportIntelSync";

/** CLIENT-284：军情 scroll-sync 残余巩固再加深环（叠 CLIENT-268 residual deep ring；CLIENT-220 双向环不退化）。 */
export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPER_RING_CLASS =
  "minimap-intel-scroll-sync-residual-deeper-ring";

export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPER_RING_MS = 1500;

export type MinimapViewportIntelScrollResidualDeeperTimers = {
  residualDeeperRingClassTimer: ReturnType<typeof setTimeout> | null;
};

export function createMinimapViewportIntelScrollResidualDeeperTimers(): MinimapViewportIntelScrollResidualDeeperTimers {
  return { residualDeeperRingClassTimer: null };
}

export type SyncMinimapViewportIntelScrollResidualDeeperOptions =
  SyncMinimapViewportIntelScrollResidualDeepOptions & {
    residualDeeperTimers?: MinimapViewportIntelScrollResidualDeeperTimers;
    residualDeeperDurationMs?: number;
  };

function clearMinimapIntelScrollSyncResidualDeeperRing(
  layoutFrame: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  marchId: number | null,
): void {
  layoutFrame?.classList.remove(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPER_RING_CLASS);
  if (intelRoot != null && marchId != null && marchId > 0) {
    intelRoot
      .querySelector<HTMLElement>(
        `.march-list li[data-march-id="${Math.trunc(marchId)}"].${MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPER_RING_CLASS}`,
      )
      ?.classList.remove(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPER_RING_CLASS);
  }
}

export type BeginMinimapIntelScrollSyncResidualDeeperRingOptions = {
  durationMs?: number;
  timers?: MinimapViewportIntelScrollResidualDeeperTimers;
  marchId?: number | null;
};

/** 在 CLIENT-268 `minimap-intel-scroll-sync-residual-deep-ring` 之上叠加 residual deeper ring 1.5s。 */
export function beginMinimapIntelScrollSyncResidualDeeperRing(
  layoutFrame: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  options?: BeginMinimapIntelScrollSyncResidualDeeperRingOptions,
): void {
  const duration = options?.durationMs ?? MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPER_RING_MS;
  const timers = options?.timers;
  const marchId =
    options?.marchId != null && Number.isFinite(options.marchId) && options.marchId > 0
      ? Math.trunc(options.marchId)
      : null;

  if (timers?.residualDeeperRingClassTimer) {
    clearTimeout(timers.residualDeeperRingClassTimer);
    timers.residualDeeperRingClassTimer = null;
  }
  clearMinimapIntelScrollSyncResidualDeeperRing(layoutFrame, intelRoot, marchId);
  if (!layoutFrame && !intelRoot) return;

  if (layoutFrame) {
    layoutFrame.classList.add(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPER_RING_CLASS);
    void layoutFrame.offsetWidth;
    if (layoutFrame.classList.contains(MINIMAP_INTEL_SYNC_RING_CLASS)) {
      /* CLIENT-220 双向环须并存 */
    }
    if (layoutFrame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS)) {
      /* CLIENT-268 residual deep ring 须并存 */
    }
  }
  if (intelRoot && marchId != null) {
    const row = intelRoot.querySelector<HTMLElement>(
      `.march-list li[data-march-id="${marchId}"]`,
    );
    row?.classList.add(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPER_RING_CLASS);
    void row?.offsetWidth;
  }

  if (timers && duration > 0) {
    timers.residualDeeperRingClassTimer = setTimeout(() => {
      timers.residualDeeperRingClassTimer = null;
      clearMinimapIntelScrollSyncResidualDeeperRing(layoutFrame, intelRoot, marchId);
    }, duration);
  }
}

/**
 * 军情行变更：CLIENT-268 scroll-sync 残余巩固加深 + residual deeper ring 1.5s（CLIENT-284）。
 */
export function syncMinimapViewportIntelScrollResidualDeeper(
  input: SyncMinimapViewportIntelScrollResidualInput,
  options?: SyncMinimapViewportIntelScrollResidualDeeperOptions,
): SyncMinimapViewportToIntelRowResult {
  const viewportResult = syncMinimapViewportIntelScrollResidualDeep(input, options);

  const march = input.march;
  const marchId = march?.march_id;
  if (viewportResult.applied && marchId != null && Number.isFinite(marchId) && marchId > 0) {
    beginMinimapIntelScrollSyncResidualDeeperRing(input.layoutFrame, input.intelRoot, {
      durationMs:
        options?.residualDeeperDurationMs ?? MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPER_RING_MS,
      timers: options?.residualDeeperTimers,
      marchId: Math.trunc(marchId),
    });
  }

  return viewportResult;
}

/** @internal vitest */
export function resetMinimapViewportIntelScrollResidualDeeperTimersForTests(
  timers: MinimapViewportIntelScrollResidualDeeperTimers,
): void {
  if (timers.residualDeeperRingClassTimer) {
    clearTimeout(timers.residualDeeperRingClassTimer);
    timers.residualDeeperRingClassTimer = null;
  }
}

/** @internal vitest — CLIENT-268 residual deep timers 仍由调用方管理 */
export type { MinimapViewportIntelScrollResidualDeepTimers };
