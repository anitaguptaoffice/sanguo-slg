#!/usr/bin/env python3
"""DATA-002：渲染扩量后的 spec/data/source/*.yml（手编文案，非 legacy 拷贝）。运行一次后由 generate_seeds.py 生成 SQL。"""
from __future__ import annotations

import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "spec/data/source"


def _inline_yaml_line(prefix: str, obj: dict) -> str:
    body = yaml.dump(
        obj, default_flow_style=True, allow_unicode=True, sort_keys=False, width=10000
    ).strip()
    return f"{prefix}{body}\n"


def dump(path: Path, doc: dict) -> None:
    header = {
        "items": "# DATA-002 道具定义（名称/描述在 meta.description；前 6 项顺序锁定 item_cfg_id 2001–2006）\n",
        "heroes": "# DATA-002 将领模板（文案重写；不含玩家实例）\n",
        "quests": "# DATA-002 任务链（标题与摘要写入 rewards.display）\n",
        "shop": "# DATA-002 商城（SHOP-001 / INTG-005 扩展货架）\n",
    }
    key = path.stem
    if key == "items":
        lines = [header["items"], "items:\n"]
        for it in doc["items"]:
            lines.append(_inline_yaml_line("  - ", it))
        text = "".join(lines)
    elif key == "heroes":
        lines = [header["heroes"], "heroes:\n"]
        for h in doc["heroes"]:
            lines.append(_inline_yaml_line("  - ", h))
        text = "".join(lines)
    else:
        text = header.get(key, "") + yaml.dump(
            doc, allow_unicode=True, sort_keys=False, width=120
        )
    path.write_text(text, encoding="utf-8")


def build_items() -> list[dict]:
    core = [
        ("food_bundle_s", "新禾粮包", "仓吏封装的初熟谷物，可立刻充实粮栈。", {"grants": {"food": 1000}}),
        ("wood_bundle_s", "新伐木捆", "林场刚运的梁料，解一城营造之急。", {"grants": {"wood": 1000}}),
        (
            "speedup_5m",
            "短促工符",
            "催工五刻，适用于建造或研究队列。",
            {"speedup_sec": 300, "applies_to": ["build", "research"]},
            2,
        ),
        (
            "recruit_scroll",
            "访贤简帖",
            "开启标准招募池一次。",
            {"hero_pool": "standard", "draws": 1},
            3,
        ),
        (
            "infantry_token",
            "步阵教令",
            "征召百名步兵列入城防。",
            {"unit_code": "infantry", "count": 100},
            4,
        ),
        (
            "cavalry_token",
            "骑队调符",
            "五十骑出营听令。",
            {"unit_code": "cavalry", "count": 50},
            4,
        ),
    ]
    items: list[dict] = []
    for row in core:
        code, name, desc, meta_extra = row[0], row[1], row[2], row[3]
        item_type = row[4] if len(row) > 4 else 1
        max_stack = 999 if item_type == 2 else (10 if item_type == 3 else (50 if item_type == 4 else 99))
        items.append(
            {
                "code": code,
                "name": name,
                "item_type": item_type,
                "max_stack": max_stack,
                "meta": {"description": desc, **meta_extra},
            }
        )

    extras = [
        ("food_bundle_m", "常备粮垛", 1, 99, "中期行军常用的成捆粮秣。", {"grants": {"food": 5000}}),
        ("wood_bundle_m", "常备木料", 1, 99, "规整梁木，支撑城防与工坊。", {"grants": {"wood": 5000}}),
        ("iron_bundle_s", "粗炼铁箱", 1, 99, "冶坊粗炼铁砂，供锻造与加固。", {"grants": {"iron": 800}}),
        ("silver_pouch_s", "薄银袋", 1, 99, "官府铸造的小额流通银铤。", {"grants": {"silver": 200}}),
        (
            "speedup_15m",
            "中程工符",
            2,
            999,
            "一炷香内完工的催造符。",
            {"speedup_sec": 900, "applies_to": ["build"]},
        ),
        (
            "recruit_scroll_rare",
            "锦绣访贤帖",
            3,
            5,
            "偏向高稀有将领的招募。",
            {"hero_pool": "elite", "draws": 1},
        ),
        (
            "archer_token",
            "弓队集训牌",
            4,
            50,
            "八十名弓手完成集训。",
            {"unit_code": "archer", "count": 80},
        ),
        (
            "siege_token",
            "攻城组件箱",
            4,
            20,
            "组装十具攻城器械。",
            {"unit_code": "siege", "count": 10},
        ),
        (
            "supply_chest_green",
            "青纹补给匣",
            1,
            20,
            "开启后随机获得基础资源。",
            {
                "reward_pack_id": "pack_supply_green",
                "box_contents": [
                    {"weight": 50, "resources": {"food": 800}},
                    {"weight": 30, "resources": {"wood": 600}},
                    {"weight": 20, "resources": {"iron": 400}},
                ],
            },
        ),
        (
            "supply_chest_blue",
            "蓝纹军需匣",
            1,
            10,
            "军需官签发的进阶补给。",
            {
                "reward_pack_id": "pack_supply_blue",
                "box_contents": [
                    {"weight": 40, "resources": {"food": 2000}},
                    {"weight": 35, "resources": {"wood": 1500}},
                    {"weight": 25, "items": [{"item_code": "speedup_5m", "qty": 2}]},
                ],
            },
        ),
        ("hero_shard_common", "将魂碎晶", 1, 999, "累积可兑换将领经验（占位）。", {"grants": {"hero_exp": 50}}),
        ("wall_stone_kit", "城防条石包", 1, 30, "用于城墙修缮的条石与砂浆。", {"grants": {"wood": 500, "iron": 300}}),
        ("banquet_ticket", "庆功席帖", 1, 5, "举办小宴提振士气（占位）。", {"grants": {"silver": 50}}),
        ("march_ration", "远征干粮", 1, 99, "缩短一次出征准备时间（占位）。", {"grants": {"food": 300}}),
        ("tax_warrant", "赋税凭条", 1, 20, "向府库兑换少量银铤。", {"grants": {"silver": 100}}),
        ("drill_manual", "操典摘抄", 1, 10, "研读后可得训练加成（占位）。", {"grants": {"silver": 30}}),
        ("envoy_gift", "使节礼单", 1, 10, "外交场合使用的礼单。", {"grants": {"wood": 400, "food": 400}}),
        ("forge_coal", "锻炉炭束", 1, 50, "提高冶炼效率的燃料。", {"grants": {"iron": 600}}),
        ("herb_pouch", "伤兵药囊", 1, 99, "救治伤兵的基础药材。", {"grants": {"food": 200}}),
        ("map_fragment", "舆图残卷", 1, 30, "拼凑后可解锁侦察（占位）。", {"grants": {"silver": 80}}),
        ("banner_emblem", "军旗纹章", 1, 5, "提升编队识别度的饰物。", {"grants": {"silver": 150}}),
        ("treaty_scroll", "盟约抄件", 1, 3, "记录同盟条款的卷轴。", {"grants": {"wood": 300}}),
        ("merit_medal", "功勋铜章", 1, 99, "兑换功勋点（占位）。", {"grants": {"silver": 40}}),
        ("lantern_festival", "祈福灯盏", 1, 20, "节庆道具，换少量资源。", {"grants": {"food": 500, "wood": 500}}),
    ]
    for code, name, itype, stack, desc, meta in extras:
        items.append(
            {"code": code, "name": name, "item_type": itype, "max_stack": stack, "meta": {"description": desc, **meta}}
        )

    # DATA-002 扩量：资源包、加速、训练令与杂项（无宝箱，控制 reward_rows）
    bulk_names = [
        ("grain_satchel", "粮栈转运袋", {"grants": {"food": 2500}}),
        ("timber_crate", "梁木货箱", {"grants": {"wood": 2500}}),
        ("ore_crate", "矿砂货箱", {"grants": {"iron": 1200}}),
        ("coin_roll", "银铤卷", {"grants": {"silver": 350}}),
        ("speedup_30m", "长程工符", {"speedup_sec": 1800, "applies_to": ["build", "research"]}),
        ("speedup_60m", "整日工符", {"speedup_sec": 3600, "applies_to": ["build"]}),
        ("recruit_scroll_plus", "广纳贤帖", {"hero_pool": "standard", "draws": 2}),
        ("infantry_token_l", "步阵大教令", {"unit_code": "infantry", "count": 250}),
        ("cavalry_token_l", "骑队大调符", {"unit_code": "cavalry", "count": 120}),
        ("archer_token_l", "弓队大集训牌", {"unit_code": "archer", "count": 150}),
        ("siege_token_l", "重型攻城组件", {"unit_code": "siege", "count": 25}),
        ("ration_field", "野战粮包", {"grants": {"food": 800}}),
        ("timber_wedge", "楔木加固包", {"grants": {"wood": 700}}),
        ("ingot_bundle", "铁锭捆", {"grants": {"iron": 900}}),
        ("well_repair_kit", "井渠修缮包", {"grants": {"food": 600, "wood": 200}}),
        ("road_gravel", "道桥碎石", {"grants": {"wood": 450, "iron": 150}}),
        ("signal_flare", "烽烟信号弹", {"grants": {"silver": 45}}),
        ("shield_blank", "盾胚料", {"grants": {"iron": 200, "wood": 150}}),
        ("catapult_rope", "弩车缆绳", {"grants": {"wood": 400}}),
    ]
    for i, (code, name, meta) in enumerate(bulk_names, start=1):
        itype = 2 if "speedup" in code else (3 if "recruit" in code else (4 if "token" in code else 1))
        stack = 999 if itype == 2 else (5 if itype == 3 else (30 if itype == 4 else 99))
        desc = f"{name}：城务与军备常用物资，开箱即用。"
        if itype == 2:
            desc = f"{name}：写入工符时长，可缩短建造或研究队列。"
        elif itype == 3:
            desc = f"{name}：持帖可开启对应招募池。"
        elif itype == 4:
            desc = f"{name}：一次性征训令，按元数据发放兵种。"
        items.append(
            {"code": code, "name": name, "item_type": itype, "max_stack": stack, "meta": {"description": desc, **meta}}
        )

    return items


def build_heroes() -> list[dict]:
    base = [
        ("xuan_de_lord", "玄德府君", 5, "以仁政安抚百姓，重整州县秩序。"),
        ("green_dragon", "青龙偃月帅", 5, "长刀所向，先登破阵。"),
        ("thunder_spear", "雷矛先锋", 4, "声如雷霆，冲锋不退。"),
        ("silver_rider", "银甲骑将", 4, "七进七出，护主周全。"),
        ("sun_archer", "落日神弓", 4, "百步穿杨，镇守要道。"),
        ("wind_cavalry", "疾风铁骑", 4, "西凉铁骑，奔袭如风。"),
        ("jade_strategist", "碧玉谋臣", 5, "运筹帷幄，决胜千里。"),
        ("fire_general", "赤焰都督", 5, "火烧连营，克敌先机。"),
        ("north_wall", "北境柱石", 4, "固守边塞，御敌于外。"),
        ("river_sage", "江左智囊", 4, "善借地利，以弱胜强。"),
        ("stone_fort", "坚城守御", 3, "深沟高垒，令敌难越。"),
        ("dawn_marshal", "破晓元帅", 5, "统御三军，开疆拓土。"),
        ("ink_advisor", "墨香学士", 3, "典章律令，教化士民。"),
        ("bamboo_guard", "青竹卫尉", 3, "护卫宫阙，肃清宵小。"),
        ("frost_blade", "寒霜剑侍", 3, "剑出如霜，斩尽来犯。"),
        ("gold_envoy", "金印使节", 3, "游说诸侯，缔结盟约。"),
        ("crane_healer", "白鹤医官", 2, "疗伤济世，稳军心。"),
        ("bronze_smith", "青铜匠师", 2, "锻造兵戈，补给前线。"),
        ("reed_scout", "芦荡斥候", 2, "探查敌情，回报迅捷。"),
        ("plum_hermit", "梅岭隐士", 2, "避世研兵，偶献奇策。"),
    ]
    heroes = []
    stat_profiles = [
        (72, 75, 88, 78),
        (95, 62, 55, 82),
        (92, 45, 40, 75),
        (88, 70, 58, 85),
        (90, 68, 52, 80),
        (91, 55, 48, 79),
        (48, 96, 90, 70),
        (89, 78, 60, 92),
        (86, 72, 65, 84),
        (52, 91, 82, 68),
        (78, 60, 70, 76),
        (93, 74, 62, 94),
        (40, 85, 88, 55),
        (82, 58, 50, 72),
        (84, 64, 45, 74),
        (55, 80, 92, 60),
        (35, 88, 75, 48),
        (60, 70, 55, 50),
        (65, 68, 40, 62),
        (50, 82, 60, 52),
    ]
    for (code, name, rarity, tag), (f, intel, pol, cmd) in zip(base, stat_profiles):
        heroes.append(
            {
                "code": code,
                "name": name,
                "rarity": rarity,
                "base_stats": {
                    "force": f,
                    "intel": intel,
                    "politics": pol,
                    "command": cmd,
                    "tagline": tag,
                },
            }
        )

    extra_titles = [
        ("azure_phalanx", "青岚方阵", 4, "列阵如墙，稳步推进。"),
        ("ember_duelist", "烬锋斗士", 3, "近身缠斗，以快制慢。"),
        ("mist_ranger", "雾林游侠", 3, "借林隐匿，奇袭粮道。"),
        ("coral_admiral", "珊瑚水师", 4, "熟谙潮汐，控扼津渡。"),
        ("sand_pillar", "沙洲柱将", 3, "据险守渡，拖垮来犯。"),
        ("iron_bard", "铁弦乐士", 2, "军歌振气，稳阵脚。"),
        ("lotus_healer", "莲塘医女", 2, "清创敷药，减员损。"),
        ("copper_quarter", "铜衡督粮", 3, "精算粮秣，省耗十之一。"),
        ("jade_sentinel", "玉门哨帅", 4, "夜巡关隘，不漏烽火。"),
        ("storm_lancer", "惊雷枪骑", 4, "枪出如电，破阵一线。"),
        ("pine_sage", "松岭谋士", 3, "善用地形，诱敌深入。"),
        ("reed_admiral", "苇泽舟帅", 3, "浅水伏击，断敌舟楫。"),
        ("granite_warden", "磐石戍将", 4, "身先士卒，稳守城楼。"),
        ("silk_diplomat", "锦帛行卿", 3, "舌锋如剑，化战为盟。"),
        ("amber_alchemist", "琥珀丹师", 2, "调制伤药，略通火攻。"),
        ("obsidian_scout", "玄羽探子", 2, "潜行百里，回报如飞。"),
        ("harbor_master", "津渡监官", 3, "调度舟楫，通商饷。"),
        ("field_engineer", "野营匠首", 3, "立寨开壕，速成营垒。"),
        ("dawn_archer", "晨曦弓监", 3, "晨射百步，教众卒。"),
        ("night_captain", "夜巡都尉", 4, "暗哨连环，御偷袭。"),
    ]
    for i, (code, name, rarity, tag) in enumerate(extra_titles):
        f = 55 + (i * 3) % 40
        heroes.append(
            {
                "code": code,
                "name": name,
                "rarity": rarity,
                "base_stats": {
                    "force": min(95, f + 10),
                    "intel": 50 + (i * 5) % 45,
                    "politics": 45 + (i * 7) % 40,
                    "command": 55 + (i * 4) % 38,
                    "tagline": tag,
                },
            }
        )
    return heroes


def build_quests() -> list[dict]:
    quests: list[dict] = [
        {
            "code": "tutorial_build_hall",
            "title": "奠基治所",
            "summary": "将官府升至二级，确立号令所出。",
            "quest_type": 1,
            "chain_id": 100,
            "sort_in_chain": 1,
            "unlock_level": 1,
            "objectives": [{"type": "build_level", "building_cfg_id": 1, "level": 2}],
            "rewards": {"resources": {"food": 500}, "items": [{"item_code": "food_bundle_s", "qty": 1}]},
        },
        {
            "code": "tutorial_recruit",
            "title": "延贤入幕",
            "summary": "完成一次将领招募。",
            "quest_type": 1,
            "chain_id": 100,
            "prev_quest_code": "tutorial_build_hall",
            "sort_in_chain": 2,
            "unlock_level": 1,
            "objectives": [{"type": "recruit_hero", "count": 1}],
            "rewards": {"items": [{"item_code": "recruit_scroll", "qty": 1}]},
        },
        {
            "code": "chain100_farm",
            "title": "垦辟良田",
            "summary": "农田升至三级，稳住粮源。",
            "quest_type": 1,
            "chain_id": 100,
            "prev_quest_code": "tutorial_recruit",
            "sort_in_chain": 3,
            "unlock_level": 2,
            "objectives": [{"type": "build_level", "building_cfg_id": 2, "level": 3}],
            "rewards": {"resources": {"food": 1200}, "items": [{"item_code": "food_bundle_m", "qty": 1}]},
        },
        {
            "code": "chain100_lumber",
            "title": "整饬林场",
            "summary": "伐木场二级，保障城建木料。",
            "quest_type": 1,
            "chain_id": 100,
            "prev_quest_code": "chain100_farm",
            "sort_in_chain": 4,
            "unlock_level": 3,
            "objectives": [{"type": "build_level", "building_cfg_id": 3, "level": 2}],
            "rewards": {"resources": {"wood": 1000}, "items": [{"item_code": "wood_bundle_s", "qty": 2}]},
        },
        {
            "code": "chain100_barracks",
            "title": "开营整训",
            "summary": "兵营升至二级，解锁基础征募。",
            "quest_type": 1,
            "chain_id": 100,
            "prev_quest_code": "chain100_lumber",
            "sort_in_chain": 5,
            "unlock_level": 4,
            "objectives": [{"type": "build_level", "building_cfg_id": 6, "level": 2}],
            "rewards": {"items": [{"item_code": "infantry_token", "qty": 1}]},
        },
        {
            "code": "chain200_wall",
            "title": "修筑城垣",
            "summary": "城墙一级，提升城防评级。",
            "quest_type": 1,
            "chain_id": 200,
            "sort_in_chain": 1,
            "unlock_level": 5,
            "objectives": [{"type": "build_level", "building_cfg_id": 7, "level": 1}],
            "rewards": {"resources": {"wood": 800}, "items": [{"item_code": "wall_stone_kit", "qty": 1}]},
        },
        {
            "code": "chain200_iron",
            "title": "开炉冶铁",
            "summary": "铁矿升至二级，支撑军械。",
            "quest_type": 1,
            "chain_id": 200,
            "prev_quest_code": "chain200_wall",
            "sort_in_chain": 2,
            "unlock_level": 6,
            "objectives": [{"type": "build_level", "building_cfg_id": 5, "level": 2}],
            "rewards": {"resources": {"iron": 600}, "items": [{"item_code": "iron_bundle_s", "qty": 1}]},
        },
        {
            "code": "chain200_hall5",
            "title": "府库充盈",
            "summary": "官府五级，解锁更多政令。",
            "quest_type": 1,
            "chain_id": 200,
            "prev_quest_code": "chain200_iron",
            "sort_in_chain": 3,
            "unlock_level": 8,
            "objectives": [{"type": "build_level", "building_cfg_id": 1, "level": 5}],
            "rewards": {"resources": {"silver": 300}, "items": [{"item_code": "supply_chest_green", "qty": 1}]},
        },
        {
            "code": "chain300_train_inf",
            "title": "步阵成军",
            "summary": "累计训练步兵两百名。",
            "quest_type": 1,
            "chain_id": 300,
            "sort_in_chain": 1,
            "unlock_level": 6,
            "objectives": [{"type": "train_troops", "unit_code": "infantry", "count": 200}],
            "rewards": {"items": [{"item_code": "infantry_token", "qty": 2}]},
        },
        {
            "code": "chain300_train_cav",
            "title": "铁骑集结",
            "summary": "累计训练骑兵八十名。",
            "quest_type": 1,
            "chain_id": 300,
            "prev_quest_code": "chain300_train_inf",
            "sort_in_chain": 2,
            "unlock_level": 8,
            "objectives": [{"type": "train_troops", "unit_code": "cavalry", "count": 80}],
            "rewards": {"items": [{"item_code": "cavalry_token", "qty": 1}]},
        },
        {
            "code": "chain300_recruit2",
            "title": "再开贤馆",
            "summary": "完成第二次将领招募。",
            "quest_type": 1,
            "chain_id": 300,
            "prev_quest_code": "chain300_train_cav",
            "sort_in_chain": 3,
            "unlock_level": 9,
            "objectives": [{"type": "recruit_hero", "count": 2}],
            "rewards": {"items": [{"item_code": "recruit_scroll_rare", "qty": 1}]},
        },
        {
            "code": "daily_food_1",
            "title": "日课·筹粮",
            "summary": "为城池收集五千粮食。",
            "quest_type": 2,
            "chain_id": 400,
            "sort_in_chain": 1,
            "unlock_level": 5,
            "repeatable": True,
            "objectives": [{"type": "collect_resource", "resource": "food", "count": 5000}],
            "rewards": {"resources": {"silver": 25}},
        },
        {
            "code": "daily_wood_1",
            "title": "日课·备木",
            "summary": "收集四千木材。",
            "quest_type": 2,
            "chain_id": 400,
            "sort_in_chain": 2,
            "unlock_level": 5,
            "repeatable": True,
            "objectives": [{"type": "collect_resource", "resource": "wood", "count": 4000}],
            "rewards": {"resources": {"silver": 25}},
        },
        {
            "code": "daily_train_1",
            "title": "日课·操练",
            "summary": "今日训练任意兵种五十名。",
            "quest_type": 2,
            "chain_id": 400,
            "sort_in_chain": 3,
            "unlock_level": 6,
            "repeatable": True,
            "objectives": [{"type": "train_troops", "unit_code": "any", "count": 50}],
            "rewards": {"items": [{"item_code": "speedup_5m", "qty": 1}]},
        },
        {
            "code": "daily_recruit_1",
            "title": "日课·访贤",
            "summary": "进行一次招募。",
            "quest_type": 2,
            "chain_id": 400,
            "sort_in_chain": 4,
            "unlock_level": 7,
            "repeatable": True,
            "objectives": [{"type": "recruit_hero", "count": 1}],
            "rewards": {"resources": {"silver": 40}},
        },
        {
            "code": "side_envoy",
            "title": "使节抵城",
            "summary": "官府三级后接待使节。",
            "quest_type": 3,
            "unlock_level": 4,
            "objectives": [{"type": "build_level", "building_cfg_id": 1, "level": 3}],
            "rewards": {"items": [{"item_code": "envoy_gift", "qty": 1}]},
        },
        {
            "code": "side_forge",
            "title": "试炉锻铁",
            "summary": "交付铁砂试开锻炉。",
            "quest_type": 3,
            "unlock_level": 7,
            "objectives": [{"type": "collect_resource", "resource": "iron", "count": 2000}],
            "rewards": {"items": [{"item_code": "forge_coal", "qty": 2}]},
        },
        {
            "code": "side_scout",
            "title": "拼合舆图",
            "summary": "收集三份舆图残卷。",
            "quest_type": 3,
            "unlock_level": 6,
            "objectives": [{"type": "use_item", "item_code": "map_fragment", "count": 3}],
            "rewards": {"items": [{"item_code": "supply_chest_blue", "qty": 1}]},
        },
    ]

    # 扩量：链 500 内政、600 军备、700 日常扩展、800 支线
    def add_chain(chain_id: int, start_level: int, templates: list[tuple]) -> None:
        prev = None
        for sort_i, (code, title, summary, obj, reward) in enumerate(templates, start=1):
            q = {
                "code": code,
                "title": title,
                "summary": summary,
                "quest_type": 1 if chain_id < 700 else (2 if chain_id < 800 else 3),
                "chain_id": chain_id,
                "sort_in_chain": sort_i,
                "unlock_level": start_level + sort_i - 1,
                "objectives": obj,
                "rewards": reward,
            }
            if prev:
                q["prev_quest_code"] = prev
            if chain_id >= 700 and chain_id < 800:
                q["repeatable"] = True
            quests.append(q)
            prev = code

    chain500 = [
        (
            "chain500_mill",
            "修葺磨坊",
            "磨坊一级，提高粮秣加工。",
            [{"type": "build_level", "building_cfg_id": 2, "level": 4}],
            {"resources": {"food": 800}},
        ),
        (
            "chain500_store",
            "扩建仓廪",
            "仓廪二级，提升储粮上限（占位）。",
            [{"type": "build_level", "building_cfg_id": 1, "level": 4}],
            {"items": [{"item_code": "grain_satchel", "qty": 1}]},
        ),
        (
            "chain500_road",
            "铺筑驿道",
            "交付木材铺驿道。",
            [{"type": "collect_resource", "resource": "wood", "count": 3000}],
            {"items": [{"item_code": "road_gravel", "qty": 1}]},
        ),
        (
            "chain500_well",
            "开凿井渠",
            "官府四级并收集粮食。",
            [
                {"type": "build_level", "building_cfg_id": 1, "level": 4},
                {"type": "collect_resource", "resource": "food", "count": 2000},
            ],
            {"items": [{"item_code": "well_repair_kit", "qty": 1}]},
        ),
        (
            "chain500_tax",
            "清账赋税",
            "收集银铤充实府库。",
            [{"type": "collect_resource", "resource": "silver", "count": 500}],
            {"items": [{"item_code": "tax_warrant", "qty": 2}]},
        ),
    ]
    add_chain(500, 6, chain500)

    chain600 = [
        (
            "chain600_archer",
            "弓队成列",
            "训练弓兵六十名。",
            [{"type": "train_troops", "unit_code": "archer", "count": 60}],
            {"items": [{"item_code": "archer_token", "qty": 1}]},
        ),
        (
            "chain600_siege",
            "器械整备",
            "训练器械五具。",
            [{"type": "train_troops", "unit_code": "siege", "count": 5}],
            {"items": [{"item_code": "siege_token", "qty": 1}]},
        ),
        (
            "chain600_wall2",
            "加高城墙",
            "城墙升至二级。",
            [{"type": "build_level", "building_cfg_id": 7, "level": 2}],
            {"items": [{"item_code": "wall_stone_kit", "qty": 2}]},
        ),
        (
            "chain600_drill",
            "校场操演",
            "任意兵种训练一百名。",
            [{"type": "train_troops", "unit_code": "any", "count": 100}],
            {"items": [{"item_code": "drill_manual", "qty": 1}]},
        ),
        (
            "chain600_banner",
            "立旗誓师",
            "收集木材与铁砂。",
            [
                {"type": "collect_resource", "resource": "wood", "count": 2500},
                {"type": "collect_resource", "resource": "iron", "count": 1500},
            ],
            {"items": [{"item_code": "banner_emblem", "qty": 1}]},
        ),
        (
            "chain600_recruit3",
            "三顾贤馆",
            "累计招募三名将领。",
            [{"type": "recruit_hero", "count": 3}],
            {"items": [{"item_code": "recruit_scroll_plus", "qty": 1}]},
        ),
    ]
    add_chain(600, 8, chain600)

    daily_extra = [
        (
            "daily_iron_1",
            "日课·冶铁",
            "收集三千铁砂。",
            [{"type": "collect_resource", "resource": "iron", "count": 3000}],
            {"resources": {"silver": 30}},
        ),
        (
            "daily_silver_1",
            "日课·理财",
            "收集二百银铤。",
            [{"type": "collect_resource", "resource": "silver", "count": 200}],
            {"resources": {"silver": 35}},
        ),
        (
            "daily_build_1",
            "日课·营造",
            "完成一次建造升级（占位）。",
            [{"type": "build_level", "building_cfg_id": 2, "level": 2}],
            {"items": [{"item_code": "speedup_15m", "qty": 1}]},
        ),
        (
            "daily_march_1",
            "日课·战备",
            "使用行军干粮一次。",
            [{"type": "use_item", "item_code": "march_ration", "count": 1}],
            {"items": [{"item_code": "ration_field", "qty": 1}]},
        ),
    ]
    for i, row in enumerate(daily_extra, start=5):
        code, title, summary, obj, reward = row
        quests.append(
            {
                "code": code,
                "title": title,
                "summary": summary,
                "quest_type": 2,
                "chain_id": 400,
                "sort_in_chain": i,
                "unlock_level": 6 + i,
                "repeatable": True,
                "objectives": obj,
                "rewards": reward,
            }
        )

    side_extra = [
        (
            "side_treaty",
            "草拟盟约",
            "官府六级后筹备盟约。",
            [{"type": "build_level", "building_cfg_id": 1, "level": 6}],
            {"items": [{"item_code": "treaty_scroll", "qty": 1}]},
        ),
        (
            "side_banquet",
            "庆功小宴",
            "交付粮食举办宴席。",
            [{"type": "collect_resource", "resource": "food", "count": 3500}],
            {"items": [{"item_code": "banquet_ticket", "qty": 1}]},
        ),
        (
            "side_merit",
            "记功授勋",
            "收集功勋铜章五枚。",
            [{"type": "use_item", "item_code": "merit_medal", "count": 5}],
            {"items": [{"item_code": "supply_chest_blue", "qty": 1}]},
        ),
        (
            "side_lantern",
            "点灯祈福",
            "节庆点灯换资源。",
            [{"type": "use_item", "item_code": "lantern_festival", "count": 1}],
            {"resources": {"silver": 80}},
        ),
    ]
    for row in side_extra:
        code, title, summary, obj, reward = row
        quests.append(
            {
                "code": code,
                "title": title,
                "summary": summary,
                "quest_type": 3,
                "unlock_level": 8,
                "objectives": obj,
                "rewards": reward,
            }
        )

    # 填充至约 54 条：循环变体日常
    variants = [
        ("food", "粮"),
        ("wood", "木"),
        ("iron", "铁"),
    ]
    for n in range(1, 7):
        res, label = variants[n % 3]
        quests.append(
            {
                "code": f"daily_wave9_{n:02d}",
                "title": f"日课·积{label}·{n}",
                "summary": f"第 {n} 轮日常：收集一批{label}材。",
                "quest_type": 2,
                "chain_id": 400,
                "sort_in_chain": 20 + n,
                "unlock_level": 5 + (n % 6),
                "repeatable": True,
                "objectives": [{"type": "collect_resource", "resource": res, "count": 2000 + n * 200}],
                "rewards": {"resources": {"silver": 20 + n}},
            }
        )

    return quests


def build_shop() -> dict:
    return {
        "shops": [
            {
                "code": "resource_shop",
                "name": "州府平价行",
                "unlock_level": 1,
                "shelves": [
                    {
                        "code": "daily",
                        "name": "每日平价架",
                        "sort_order": 1,
                        "offers": [
                            {
                                "code": "food_bundle_daily",
                                "item_code": "food_bundle_s",
                                "item_count": 1,
                                "price": {"resources": {"silver": 10}},
                                "per_player_daily_limit": 3,
                            },
                            {
                                "code": "wood_bundle_daily",
                                "item_code": "wood_bundle_s",
                                "item_count": 1,
                                "price": {"resources": {"silver": 10}},
                                "per_player_daily_limit": 3,
                            },
                            {
                                "code": "speedup_daily",
                                "item_code": "speedup_5m",
                                "item_count": 1,
                                "price": {"resources": {"silver": 30}},
                                "per_player_daily_limit": 2,
                            },
                            {
                                "code": "grain_satchel_daily",
                                "item_code": "grain_satchel",
                                "item_count": 1,
                                "price": {"resources": {"silver": 25}},
                                "per_player_daily_limit": 2,
                            },
                        ],
                    },
                    {
                        "code": "staple",
                        "name": "常备物资架",
                        "sort_order": 2,
                        "offers": [
                            {
                                "code": "food_bundle_m_offer",
                                "item_code": "food_bundle_m",
                                "item_count": 1,
                                "price": {"resources": {"silver": 45}},
                            },
                            {
                                "code": "wood_bundle_m_offer",
                                "item_code": "wood_bundle_m",
                                "item_count": 1,
                                "price": {"resources": {"silver": 45}},
                            },
                            {
                                "code": "iron_bundle_offer",
                                "item_code": "iron_bundle_s",
                                "item_count": 1,
                                "price": {"resources": {"silver": 50, "wood": 200}},
                            },
                            {
                                "code": "timber_crate_offer",
                                "item_code": "timber_crate",
                                "item_count": 1,
                                "price": {"resources": {"silver": 40}},
                            },
                        ],
                    },
                ],
            },
            {
                "code": "military_shop",
                "name": "军营补给栈",
                "unlock_level": 5,
                "shelves": [
                    {
                        "code": "drill",
                        "name": "操练柜台",
                        "sort_order": 1,
                        "offers": [
                            {
                                "code": "infantry_token_offer",
                                "item_code": "infantry_token",
                                "item_count": 1,
                                "price": {"resources": {"food": 800, "silver": 20}},
                                "per_player_daily_limit": 5,
                            },
                            {
                                "code": "cavalry_token_offer",
                                "item_code": "cavalry_token",
                                "item_count": 1,
                                "price": {"resources": {"food": 1200, "silver": 35}},
                                "per_player_daily_limit": 3,
                            },
                            {
                                "code": "archer_token_offer",
                                "item_code": "archer_token",
                                "item_count": 1,
                                "price": {"resources": {"wood": 600, "silver": 30}},
                                "per_player_daily_limit": 3,
                            },
                            {
                                "code": "infantry_token_l_offer",
                                "item_code": "infantry_token_l",
                                "item_count": 1,
                                "price": {"resources": {"food": 2000, "silver": 80}},
                                "per_player_daily_limit": 2,
                            },
                        ],
                    },
                    {
                        "code": "recruit",
                        "name": "访贤柜台",
                        "sort_order": 2,
                        "offers": [
                            {
                                "code": "recruit_scroll_offer",
                                "item_code": "recruit_scroll",
                                "item_count": 1,
                                "price": {"resources": {"silver": 80}},
                                "per_player_total_limit": 10,
                            },
                            {
                                "code": "recruit_scroll_rare_offer",
                                "item_code": "recruit_scroll_rare",
                                "item_count": 1,
                                "price": {"resources": {"silver": 200}},
                                "per_player_total_limit": 2,
                            },
                            {
                                "code": "recruit_scroll_plus_offer",
                                "item_code": "recruit_scroll_plus",
                                "item_count": 1,
                                "price": {"resources": {"silver": 150}},
                                "per_player_total_limit": 3,
                            },
                        ],
                    },
                ],
            },
            {
                "code": "treasury_shop",
                "name": "府库兑换处",
                "unlock_level": 8,
                "shelves": [
                    {
                        "code": "chest",
                        "name": "军需箱柜",
                        "sort_order": 1,
                        "offers": [
                            {
                                "code": "green_chest_offer",
                                "item_code": "supply_chest_green",
                                "item_count": 1,
                                "price": {"resources": {"silver": 60}},
                                "per_player_daily_limit": 2,
                            },
                            {
                                "code": "blue_chest_offer",
                                "item_code": "supply_chest_blue",
                                "item_count": 1,
                                "price": {"resources": {"silver": 150}},
                                "per_player_daily_limit": 1,
                            },
                            {
                                "code": "wall_kit_offer",
                                "item_code": "wall_stone_kit",
                                "item_count": 1,
                                "price": {"resources": {"wood": 400, "iron": 200}},
                            },
                        ],
                    }
                ],
            },
            {
                "code": "honor_shop",
                "name": "功勋兑奖台",
                "unlock_level": 10,
                "meta": {"currency_hint": "merit"},
                "shelves": [
                    {
                        "code": "merit",
                        "name": "功勋兑换",
                        "sort_order": 1,
                        "offers": [
                            {
                                "code": "merit_medal_trade",
                                "item_code": "merit_medal",
                                "item_count": 5,
                                "price": {"resources": {"silver": 100}},
                                "per_player_daily_limit": 1,
                            },
                            {
                                "code": "banner_offer",
                                "item_code": "banner_emblem",
                                "item_count": 1,
                                "price": {"resources": {"silver": 250}},
                                "per_player_total_limit": 3,
                            },
                            {
                                "code": "banquet_offer",
                                "item_code": "banquet_ticket",
                                "item_count": 1,
                                "price": {"resources": {"food": 1000, "wood": 1000}},
                            },
                        ],
                    }
                ],
            },
            {
                "code": "expedition_shop",
                "name": "远征辎重站",
                "unlock_level": 9,
                "shelves": [
                    {
                        "code": "march",
                        "name": "行军货架",
                        "sort_order": 1,
                        "offers": [
                            {
                                "code": "march_ration_offer",
                                "item_code": "march_ration",
                                "item_count": 2,
                                "price": {"resources": {"food": 400}},
                                "per_player_daily_limit": 5,
                            },
                            {
                                "code": "ration_field_offer",
                                "item_code": "ration_field",
                                "item_count": 1,
                                "price": {"resources": {"silver": 35}},
                            },
                            {
                                "code": "signal_flare_offer",
                                "item_code": "signal_flare",
                                "item_count": 1,
                                "price": {"resources": {"silver": 20}},
                            },
                        ],
                    },
                    {
                        "code": "speed",
                        "name": "催工货架",
                        "sort_order": 2,
                        "offers": [
                            {
                                "code": "speedup_15m_offer",
                                "item_code": "speedup_15m",
                                "item_count": 1,
                                "price": {"resources": {"silver": 55}},
                                "per_player_daily_limit": 3,
                            },
                            {
                                "code": "speedup_30m_offer",
                                "item_code": "speedup_30m",
                                "item_count": 1,
                                "price": {"resources": {"silver": 95}},
                                "per_player_daily_limit": 2,
                            },
                        ],
                    },
                ],
            },
            {
                "code": "artisan_shop",
                "name": "匠作材料坊",
                "unlock_level": 7,
                "shelves": [
                    {
                        "code": "craft",
                        "name": "工坊柜台",
                        "sort_order": 1,
                        "offers": [
                            {
                                "code": "forge_coal_offer",
                                "item_code": "forge_coal",
                                "item_count": 2,
                                "price": {"resources": {"iron": 300, "silver": 25}},
                            },
                            {
                                "code": "ingot_bundle_offer",
                                "item_code": "ingot_bundle",
                                "item_count": 1,
                                "price": {"resources": {"silver": 70}},
                            },
                            {
                                "code": "shield_blank_offer",
                                "item_code": "shield_blank",
                                "item_count": 1,
                                "price": {"resources": {"wood": 350, "iron": 150}},
                            },
                            {
                                "code": "catapult_rope_offer",
                                "item_code": "catapult_rope",
                                "item_count": 1,
                                "price": {"resources": {"wood": 500}},
                            },
                        ],
                    }
                ],
            },
        ]
    }


def validate_counts(quests: list, items: list, heroes: list, shop: dict) -> None:
    sys.path.insert(0, str(Path(__file__).parent))
    import generate_seeds as gen

    item_rows = gen.build_items({"items": items})
    item_by_code = gen.item_code_index(item_rows)
    quest_rows = gen.build_quests({"quests": quests}, item_by_code)
    shops, _, offers = gen.build_shop_tables(shop, item_by_code)
    hero_rows = gen.build_heroes({"heroes": heroes})
    gen.validate_core_subset(hero_rows, item_rows, quest_rows, shops, offers)
    obj = sum(len(q["objectives"]) for q in quests)
    print(
        f"ok quests={len(quests)} objectives={obj} items={len(items)} "
        f"heroes={len(heroes)} shops={len(shop['shops'])} offers={len(offers)}"
    )


def main() -> int:
    items = build_items()
    heroes = build_heroes()
    quests = build_quests()
    shop = build_shop()
    validate_counts(quests, items, heroes, shop)
    dump(SOURCE / "items.yml", {"items": items})
    dump(SOURCE / "heroes.yml", {"heroes": heroes})
    dump(SOURCE / "quests.yml", {"quests": quests})
    dump(SOURCE / "shop.yml", shop)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
