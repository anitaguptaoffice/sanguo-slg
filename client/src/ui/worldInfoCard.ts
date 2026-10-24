import type { MarchSummary } from "@/net/militaryFormat";
import type { PlayerCitySummary } from "@/net/worldFormat";
import { countMarchesAtCell } from "@/ui/marchWorldListLink";
import {
  formatMarchCountInfoLine,
  formatWorldTileInfoCard,
  type WorldTileInfoCardModel,
  type WorldTileInfoCardOptions,
  type WorldTileRef,
} from "@/ui/worldTileInfoCard";

export type WorldInfoCardSummary = WorldTileInfoCardModel;

export { countMarchesAtCell, filterInProgressMarchesAtCell } from "@/ui/marchWorldListLink";

export type BuildWorldInfoCardSummaryInput = {
  cell: WorldTileRef;
  cities: PlayerCitySummary[];
  marches: MarchSummary[];
  options?: WorldTileInfoCardOptions;
};

/** 世界只读信息卡摘要（CLIENT-140；深化 CLIENT-073 格点上下文）。 */
export function buildWorldInfoCardSummary(
  input: BuildWorldInfoCardSummaryInput,
): WorldInfoCardSummary {
  const { cell, cities, marches, options } = input;
  const base = formatWorldTileInfoCard(cell, cities, marches, options);
  const marchCount = countMarchesAtCell(marches, cell.x, cell.y);
  return {
    ...base,
    marchCount,
    marchCountLine: formatMarchCountInfoLine(marchCount),
  };
}
