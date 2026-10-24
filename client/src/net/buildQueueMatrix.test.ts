import { describe, expect, it } from "vitest";
import {
  buildBuildQueueSlotMatrix,
  buildQueueMatrixIndexForSlot,
  resolveBuildQueueSlotMatrixStatus,
  sortBuildQueueRows,
} from "@/net/buildQueueMatrix";

describe("buildQueueMatrix", () => {
  const now = 10_000_000;

  it("sortBuildQueueRows orders in-progress upgrades by earliest finish", () => {
    const rows = sortBuildQueueRows(
      [
        { slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 3000 },
        { slot_key: "hall", level: 1, upgrade_finish_at_ms: now + 1000 },
        { slot_key: "wall", level: 1, upgrade_finish_at_ms: now - 1 },
      ],
      now,
    );
    expect(rows.map((b) => b.slot_key)).toEqual(["hall", "farm"]);
  });

  it("buildQueueMatrixIndexForSlot maps hall…wall column order", () => {
    expect(buildQueueMatrixIndexForSlot("hall")).toBe(0);
    expect(buildQueueMatrixIndexForSlot("farm")).toBe(1);
    expect(buildQueueMatrixIndexForSlot("wall")).toBe(6);
    expect(buildQueueMatrixIndexForSlot("unknown")).toBeNull();
  });

  it("resolveBuildQueueSlotMatrixStatus: upgrading, upgradable, idle", () => {
    expect(
      resolveBuildQueueSlotMatrixStatus(
        "farm",
        { slot_key: "farm", level: 1, upgrade_finish_at_ms: now + 60_000 },
        {},
        now,
      ),
    ).toBe("upgrading");

    expect(
      resolveBuildQueueSlotMatrixStatus(
        "farm",
        { slot_key: "farm", level: 1, upgrade_finish_at_ms: 0 },
        { food: 9_999_999, wood: 9_999_999, stone: 9_999_999, iron: 9_999_999 },
        now,
      ),
    ).toBe("upgradable");

    expect(
      resolveBuildQueueSlotMatrixStatus(
        "farm",
        { slot_key: "farm", level: 1, upgrade_finish_at_ms: 0 },
        {},
        now,
      ),
    ).toBe("idle");
  });

  it("buildBuildQueueSlotMatrix returns seven cells with stable indices", () => {
    const matrix = buildBuildQueueSlotMatrix(
      [{ slot_key: "hall", level: 1, upgrade_finish_at_ms: now + 1 }],
      {},
      { hall: "官府", farm: "农田" },
      now,
    );
    expect(matrix).toHaveLength(7);
    expect(matrix[0]).toMatchObject({ slotKey: "hall", matrixIndex: 0, status: "upgrading" });
    expect(matrix[1].slotKey).toBe("farm");
    expect(matrix[1].matrixIndex).toBe(1);
    expect(matrix[6].slotKey).toBe("wall");
  });
});
