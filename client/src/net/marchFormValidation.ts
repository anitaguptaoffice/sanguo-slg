import { setPanelFormErrorDisplay } from "@/net/contentFormValidation";
import type { CityTroopStack } from "@/net/militaryFormat";
import { WORLD_MAP_EDGE } from "@/ui/worldMinimap";

/** 世界格点合法上界（0..WORLD_MAP_EDGE-1）。 */
export const WORLD_MAP_COORD_MAX = WORLD_MAP_EDGE - 1;

export const MARCH_FORM_INFANTRY_UNIT_CFG_ID = 1;

export type MarchFormValidationInput = {
  toXRaw: string;
  toYRaw: string;
  marchCountRaw: string;
  cityX?: number;
  cityY?: number;
  cityTroops: CityTroopStack[];
};

export type MarchFormValidationOk = {
  ok: true;
  toX: number;
  toY: number;
  marchCount: number;
};

export type MarchFormValidationFail = {
  ok: false;
  message: string;
};

export type MarchFormValidationResult = MarchFormValidationOk | MarchFormValidationFail;

function parseWorldMapCoord(raw: string, axisLabel: "X" | "Y"): number | string {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return `目标 ${axisLabel} 不能为空`;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    return `目标 ${axisLabel} 须为有效数字`;
  }
  if (!Number.isInteger(n)) {
    return `目标 ${axisLabel} 须为整数`;
  }
  if (n < 0 || n > WORLD_MAP_COORD_MAX) {
    return `目标 ${axisLabel} 须在 0～${WORLD_MAP_COORD_MAX} 之间`;
  }
  return n;
}

function availableTroopCount(cityTroops: CityTroopStack[], unitCfgId: number): number {
  const stack = cityTroops.find((t) => t.unit_cfg_id === unitCfgId);
  return stack?.count ?? 0;
}

/** 出征表单客户端校验（不发 RPC）。 */
export function validateMarchForm(input: MarchFormValidationInput): MarchFormValidationResult {
  const errors: string[] = [];

  const toXParsed = parseWorldMapCoord(input.toXRaw, "X");
  const toYParsed = parseWorldMapCoord(input.toYRaw, "Y");
  if (typeof toXParsed === "string") errors.push(toXParsed);
  if (typeof toYParsed === "string") errors.push(toYParsed);

  const marchTrimmed = input.marchCountRaw.trim();
  let marchCount = 0;
  if (marchTrimmed === "") {
    errors.push("出征步兵不能为空");
  } else {
    const n = Number(marchTrimmed);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      errors.push("出征步兵须为整数");
    } else if (n <= 0) {
      errors.push("出征步兵须大于 0");
    } else {
      marchCount = n;
      const available = availableTroopCount(input.cityTroops, MARCH_FORM_INFANTRY_UNIT_CFG_ID);
      if (n > available) {
        errors.push(`出征步兵不能超过城内可用（当前 ${available}）`);
      }
    }
  }

  if (typeof toXParsed === "number" && typeof toYParsed === "number") {
    const { cityX, cityY } = input;
    if (
      cityX != null &&
      cityY != null &&
      Number.isInteger(cityX) &&
      Number.isInteger(cityY) &&
      toXParsed === cityX &&
      toYParsed === cityY
    ) {
      errors.push("不能与己方城池同格");
    }
  }

  if (errors.length) {
    return { ok: false, message: errors.join("；") };
  }

  return {
    ok: true,
    toX: toXParsed as number,
    toY: toYParsed as number,
    marchCount,
  };
}

/** 军事面板 `data-role="march-form-error"` 内联错误区。 */
export function setMarchFormErrorDisplay(formRoot: ParentNode | null | undefined, message: string | null): void {
  setPanelFormErrorDisplay(formRoot, "march", message);
}
