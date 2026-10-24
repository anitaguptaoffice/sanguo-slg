import { describe, expect, it } from "vitest";
import type { HeroDetail } from "@/net/heroMailState";
import { HERO_STATUS_EXPR, HERO_STATUS_IDLE } from "@/net/marchHeroPick";
import {
  applyBeginHeroExprToDetail,
  applyHeroExprFinishToDetail,
  formatHeroExprBeginSuccessStatus,
  heroExprBeginDisabledReason,
  heroExprCompleteNow,
  heroExprGoldCost,
  heroExprRewardExp,
  isHeroExprInProgress,
  normalizeHeroExprHours,
  parseBeginHeroExprResponse,
  parseHeroExprFinishResponse,
} from "@/net/heroDetailExpr";

describe("heroDetailExpr (CLIENT-hero-expr-001)", () => {
  const baseDetail: HeroDetail = {
    hero_id: 9,
    level: 5,
    status: HERO_STATUS_IDLE,
  };

  it("normalizes hours to 1–4", () => {
    expect(normalizeHeroExprHours(0)).toBe(1);
    expect(normalizeHeroExprHours(3)).toBe(3);
    expect(normalizeHeroExprHours(9)).toBe(4);
  });

  it("computes gold and exp from level×hours", () => {
    expect(heroExprGoldCost(5, 2)).toBe(100);
    expect(heroExprRewardExp(5, 2)).toBe(200);
  });

  it("parseBeginHeroExprResponse maps gateway fields", () => {
    const res = parseBeginHeroExprResponse({
      hero_id: 9,
      status: 4,
      ends_at_ms: 1_700_000_000_000,
      gold_spent: 50,
      hours: 2,
    });
    expect(res.hours).toBe(2);
    expect(res.gold_spent).toBe(50);
  });

  it("applyBeginHeroExprToDetail sets expr session on detail", () => {
    const res = parseBeginHeroExprResponse({
      hero_id: 9,
      status: HERO_STATUS_EXPR,
      ends_at_ms: 1_700_000_000_000,
      gold_spent: 50,
      hours: 2,
    });
    const after = applyBeginHeroExprToDetail(baseDetail, res);
    expect(after.status).toBe(HERO_STATUS_EXPR);
    expect(after.expr_ends_at_ms).toBe(1_700_000_000_000);
    expect(isHeroExprInProgress(after)).toBe(true);
  });

  it("heroExprCompleteNow respects ends_at_ms", () => {
    const detail = applyBeginHeroExprToDetail(baseDetail, {
      hero_id: 9,
      status: HERO_STATUS_EXPR,
      ends_at_ms: 1_000,
      gold_spent: 10,
      hours: 1,
    });
    expect(heroExprCompleteNow(detail, 999)).toBe(false);
    expect(heroExprCompleteNow(detail, 1000)).toBe(true);
  });

  it("begin disabled when gold insufficient", () => {
    const reason = heroExprBeginDisabledReason(baseDetail, { gold: 10 }, 2);
    expect(reason).toContain("黄金不足");
  });

  it("finish response updates exp and clears expr", () => {
    const inExpr = applyBeginHeroExprToDetail(baseDetail, {
      hero_id: 9,
      status: HERO_STATUS_EXPR,
      ends_at_ms: 1,
      gold_spent: 10,
      hours: 1,
    });
    const fin = parseHeroExprFinishResponse({
      hero_id: 9,
      status: HERO_STATUS_IDLE,
      exp_gained: 100,
      exp: 500,
    });
    const after = applyHeroExprFinishToDetail(inExpr, fin);
    expect(after.exp).toBe(500);
    expect(after.expr_ends_at_ms).toBeUndefined();
    expect(isHeroExprInProgress(after)).toBe(false);
  });

  it("formatHeroExprBeginSuccessStatus mentions hours", () => {
    expect(formatHeroExprBeginSuccessStatus({ hero_id: 1, status: 4, ends_at_ms: 0, gold_spent: 30, hours: 3 })).toContain(
      "3小时",
    );
  });
});
