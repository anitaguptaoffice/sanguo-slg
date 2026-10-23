#!/usr/bin/env python3
"""SPEC-004 / DATA-001：从 params.yml 与 spec/data/source 生成静态配置 seed（幂等）。"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
PARAMS = ROOT / "spec/rules/params.yml"
SOURCE = ROOT / "spec/data/source"
OUT = ROOT / "spec/data/generated"
CATALOG_EMBED = ROOT / "internal/content/seed/catalog.json"

UNIT_ORDER = ["infantry", "cavalry", "archer", "siege"]
UNIT_NAMES = {"infantry": "步兵", "cavalry": "骑兵", "archer": "弓兵", "siege": "器械"}
UNIT_TIER = {"infantry": 1, "cavalry": 2, "archer": 2, "siege": 3}
HERO_ID_START, ITEM_ID_START = 1001, 2001
QUEST_ID_START, OFFER_ID_START = 1001, 1001
SHOP_ID_START, SHELF_ID_START = 1, 1

# spec/data/CORE_SUBSET.md
SUBSET_LIMITS = {
    "quests": 120,
    "objectives": 180,
    "items": 180,
    "heroes": 90,
    "shops": 18,
    "offers": 120,
    "reward_rows": 90,
}


def load_yaml(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def sql_json(obj: object) -> str:
    return sql_str(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))


def sql_scalar(v: object) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, str):
        return sql_str(v)
    return str(v)


def build_units(params: dict) -> list[dict]:
    troops, counter, edges = (
        params["combat"]["troops"],
        params["combat"]["counter"],
        params["combat"]["counter_edges"],
    )
    rows = []
    for i, code in enumerate(UNIT_ORDER, start=1):
        t = troops[code]
        stats = {**t, "troop_type": code, "counter": counter, "counter_edges": edges}
        rows.append(
            {
                "unit_cfg_id": i,
                "code": code,
                "name": UNIT_NAMES[code],
                "tier": UNIT_TIER[code],
                "stats": stats,
            }
        )
    return rows


def build_heroes(source: dict) -> list[dict]:
    return [
        {
            "template_cfg_id": HERO_ID_START + i,
            "code": h["code"],
            "name": h["name"],
            "rarity": h["rarity"],
            "base_stats": h["base_stats"],
        }
        for i, h in enumerate(source.get("heroes", []))
    ]


def build_items(source: dict) -> list[dict]:
    return [
        {
            "item_cfg_id": ITEM_ID_START + i,
            "code": it["code"],
            "name": it["name"],
            "item_type": it["item_type"],
            "max_stack": it["max_stack"],
            "meta": it.get("meta", {}),
        }
        for i, it in enumerate(source.get("items", []))
    ]


def item_code_index(items: list[dict]) -> dict[str, int]:
    return {row["code"]: row["item_cfg_id"] for row in items}


def _reward_wire(raw: dict, item_by_code: dict[str, int]) -> dict:
    out: dict = {}
    if title := raw.get("title"):
        out.setdefault("display", {})["title"] = title
    if summary := raw.get("summary"):
        out.setdefault("display", {})["summary"] = summary
    if pack := raw.get("reward_pack_id"):
        out["reward_pack_id"] = pack
    if res := raw.get("resources"):
        out["resources"] = res
    items = []
    for it in raw.get("items", []):
        cfg_id = it.get("item_cfg_id")
        if cfg_id is None:
            cfg_id = item_by_code[it["item_code"]]
        items.append({"item_cfg_id": cfg_id, "qty": it["qty"]})
    if items:
        out["items"] = items
    return out


def build_quests(source: dict, item_by_code: dict[str, int]) -> list[dict]:
    quests_in = source.get("quests", [])
    code_to_id = {
        q["code"]: QUEST_ID_START + i for i, q in enumerate(quests_in)
    }
    rows = []
    for i, q in enumerate(quests_in):
        rewards_raw = dict(q.get("rewards") or {})
        if q.get("title"):
            rewards_raw.setdefault("title", q["title"])
        if q.get("summary"):
            rewards_raw.setdefault("summary", q["summary"])
        prev_id = None
        if prev_code := q.get("prev_quest_code"):
            prev_id = code_to_id.get(prev_code)
        rows.append(
            {
                "quest_cfg_id": QUEST_ID_START + i,
                "code": q["code"],
                "quest_type": q.get("quest_type", 1),
                "rewards": _reward_wire(rewards_raw, item_by_code),
                "chain_id": q.get("chain_id"),
                "prev_quest_cfg_id": prev_id,
                "sort_in_chain": q.get("sort_in_chain", 0),
                "objectives": q.get("objectives", []),
                "unlock_level": q.get("unlock_level", 1),
                "repeatable": bool(q.get("repeatable", False)),
            }
        )
    return rows


def build_shop_tables(
    source: dict, item_by_code: dict[str, int]
) -> tuple[list[dict], list[dict], list[dict]]:
    shops_out: list[dict] = []
    shelves_out: list[dict] = []
    offers_out: list[dict] = []
    shelf_id = SHELF_ID_START
    offer_id = OFFER_ID_START
    for si, shop in enumerate(source.get("shops", [])):
        shop_cfg_id = SHOP_ID_START + si
        shops_out.append(
            {
                "shop_cfg_id": shop_cfg_id,
                "code": shop["code"],
                "name": shop["name"],
                "unlock_level": shop.get("unlock_level", 1),
                "meta": shop.get("meta", {}),
            }
        )
        for shelf in shop.get("shelves", []):
            shelves_out.append(
                {
                    "shelf_cfg_id": shelf_id,
                    "shop_cfg_id": shop_cfg_id,
                    "code": shelf["code"],
                    "name": shelf["name"],
                    "sort_order": shelf.get("sort_order", 0),
                    "meta": shelf.get("meta", {}),
                }
            )
            for oi, offer in enumerate(shelf.get("offers", [])):
                price = offer.get("price", {})
                offers_out.append(
                    {
                        "offer_cfg_id": offer_id,
                        "shelf_cfg_id": shelf_id,
                        "code": offer["code"],
                        "item_cfg_id": item_by_code[offer["item_code"]],
                        "item_count": offer.get("item_count", 1),
                        "price": price,
                        "server_stock_limit": offer.get("server_stock_limit"),
                        "per_player_daily_limit": offer.get("per_player_daily_limit"),
                        "per_player_total_limit": offer.get("per_player_total_limit"),
                        "sort_order": offer.get("sort_order", oi),
                        "meta": offer.get("meta", {}),
                    }
                )
                offer_id += 1
            shelf_id += 1
    return shops_out, shelves_out, offers_out


def count_reward_rows(quests: list[dict], items: list[dict]) -> int:
    n = 0
    for q in quests:
        rw = q["rewards"]
        n += len(rw.get("items", []))
        n += len(rw.get("resources") or {})
    for it in items:
        meta = it.get("meta") or {}
        if meta.get("grants"):
            n += 1
        for row in meta.get("box_contents", []):
            n += 1
        if meta.get("reward_pack_id"):
            n += 1
    return n


def validate_core_subset(
    heroes: list[dict],
    items: list[dict],
    quests: list[dict],
    shops: list[dict],
    offers: list[dict],
) -> None:
    obj_count = sum(len(q["objectives"]) for q in quests)
    reward_rows = count_reward_rows(quests, items)
    checks = [
        ("quests", len(quests), SUBSET_LIMITS["quests"]),
        ("objectives", obj_count, SUBSET_LIMITS["objectives"]),
        ("items", len(items), SUBSET_LIMITS["items"]),
        ("heroes", len(heroes), SUBSET_LIMITS["heroes"]),
        ("shops", len(shops), SUBSET_LIMITS["shops"]),
        ("offers", len(offers), SUBSET_LIMITS["offers"]),
        ("reward_rows", reward_rows, SUBSET_LIMITS["reward_rows"]),
    ]
    for name, got, limit in checks:
        if got > limit:
            raise ValueError(f"CORE_SUBSET {name}: {got} > {limit}")


def build_catalog_json(items: list[dict]) -> str:
    bag_cap = max(32, len(items) + 8)
    rows = [
        {
            "item_cfg_id": r["item_cfg_id"],
            "code": r["code"],
            "name": r["name"],
            "item_type": r["item_type"],
            "max_stack": r["max_stack"],
            "meta": r["meta"],
        }
        for r in items
    ]
    return json.dumps(
        {"bag_max_distinct_items": bag_cap, "items": rows},
        ensure_ascii=False,
        indent=2,
    ) + "\n"


def build_buildings(params: dict, meta_source: dict) -> list[dict]:
    build, production, main_hall = (
        params["domestic"]["build"],
        params["domestic"]["production"],
        params["domestic"]["main_hall"],
    )
    rows = []
    for b in meta_source.get("buildings", []):
        code = b["code"]
        cfg = build["buildings"].get(code, {})
        row = {
            "building_cfg_id": b["building_cfg_id"],
            "code": code,
            "name": b["name"],
            "category": b["category"],
            "base_time_sec": cfg.get("base_time_sec"),
            "base_cost": cfg.get("base_cost"),
            "cost_growth": build.get("cost_growth"),
            "time_growth": build.get("time_growth"),
            "main_hall_production_bonus_per_level": main_hall.get(
                "production_bonus_per_level"
            ),
        }
        if code in production:
            row["production"] = production[code]
        rows.append(row)
    return rows


JSON_COLS = frozenset(
    {"stats", "base_stats", "meta", "rewards", "objectives", "price"}
)
NULLABLE_COLS = frozenset(
    {
        "chain_id",
        "prev_quest_cfg_id",
        "server_stock_limit",
        "per_player_daily_limit",
        "per_player_total_limit",
    }
)


def _row_val(row: dict, col: str) -> str:
    v = row[col]
    if col in NULLABLE_COLS and v is None:
        return "NULL"
    if col in JSON_COLS:
        return sql_json(v)
    return sql_scalar(v)


def upsert_sql(table: str, pk: str, columns: list[str], rows: list[dict]) -> str:
    hdr = "-- generated by tools/data/generate_seeds.py; do not edit\n\n"
    col_list = ", ".join(columns)
    set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in columns if c != pk)
    body = []
    for row in rows:
        vals = ", ".join(_row_val(row, c) for c in columns)
        body.append(
            f"INSERT INTO {table} ({col_list}) VALUES ({vals}) "
            f"ON CONFLICT ({pk}) DO UPDATE SET {set_clause};"
        )
    return hdr + "\n".join(body) + "\n"


def write_if_changed(path: Path, content: str) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return False
    path.write_text(content, encoding="utf-8")
    return True


def generate() -> dict[str, str]:
    params = load_yaml(PARAMS)
    heroes_src = load_yaml(SOURCE / "heroes.yml")
    items_src = load_yaml(SOURCE / "items.yml")
    buildings_src = load_yaml(SOURCE / "buildings.yml")
    quests_src = load_yaml(SOURCE / "quests.yml")
    shop_src = load_yaml(SOURCE / "shop.yml")

    units = build_units(params)
    heroes = build_heroes(heroes_src)
    items = build_items(items_src)
    item_by_code = item_code_index(items)
    quests = build_quests(quests_src, item_by_code)
    shops, shelves, offers = build_shop_tables(shop_src, item_by_code)

    validate_core_subset(heroes, items, quests, shops, offers)

    quest_cols = [
        "quest_cfg_id",
        "code",
        "quest_type",
        "rewards",
        "chain_id",
        "prev_quest_cfg_id",
        "sort_in_chain",
        "objectives",
        "unlock_level",
        "repeatable",
    ]
    return {
        "cfg_unit.sql": upsert_sql(
            "cfg_unit",
            "unit_cfg_id",
            ["unit_cfg_id", "code", "name", "tier", "stats"],
            units,
        ),
        "cfg_hero_template.sql": upsert_sql(
            "cfg_hero_template",
            "template_cfg_id",
            ["template_cfg_id", "code", "name", "rarity", "base_stats"],
            heroes,
        ),
        "cfg_item.sql": upsert_sql(
            "cfg_item",
            "item_cfg_id",
            ["item_cfg_id", "code", "name", "item_type", "max_stack", "meta"],
            items,
        ),
        "cfg_quest.sql": upsert_sql("cfg_quest", "quest_cfg_id", quest_cols, quests),
        "cfg_shop.sql": upsert_sql(
            "cfg_shop",
            "shop_cfg_id",
            ["shop_cfg_id", "code", "name", "unlock_level", "meta"],
            shops,
        ),
        "cfg_shop_shelf.sql": upsert_sql(
            "cfg_shop_shelf",
            "shelf_cfg_id",
            [
                "shelf_cfg_id",
                "shop_cfg_id",
                "code",
                "name",
                "sort_order",
                "meta",
            ],
            shelves,
        ),
        "cfg_shop_offer.sql": upsert_sql(
            "cfg_shop_offer",
            "offer_cfg_id",
            [
                "offer_cfg_id",
                "shelf_cfg_id",
                "code",
                "item_cfg_id",
                "item_count",
                "price",
                "server_stock_limit",
                "per_player_daily_limit",
                "per_player_total_limit",
                "sort_order",
                "meta",
            ],
            offers,
        ),
        "cfg_building.json": json.dumps(
            {"version": 1, "buildings": build_buildings(params, buildings_src)},
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + "\n",
        "catalog.json": build_catalog_json(items),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="校验 generated 与源一致")
    args = parser.parse_args()
    try:
        outputs = generate()
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    if args.check:
        for name, content in outputs.items():
            path = OUT / name
            if not path.exists() or path.read_text(encoding="utf-8") != content:
                print(f"stale or missing: {path}", file=sys.stderr)
                return 1
        if CATALOG_EMBED.read_text(encoding="utf-8") != outputs["catalog.json"]:
            print(f"stale or missing: {CATALOG_EMBED}", file=sys.stderr)
            return 1
        print("check ok")
        return 0
    changed = [n for n, c in outputs.items() if write_if_changed(OUT / n, c)]
    embed = outputs["catalog.json"]
    if write_if_changed(CATALOG_EMBED, embed):
        changed.append("internal/content/seed/catalog.json")
    print("updated: " + ", ".join(changed) if changed else "unchanged")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
