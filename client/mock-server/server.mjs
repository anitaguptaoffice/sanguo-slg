import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import protobuf from "protobufjs";
import { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const protoRoot = path.resolve(__dirname, "../../spec/proto");

function loadRoot() {
  const root = new protobuf.Root();
  const files = [
    "sanguo/common/v1/types.proto",
    "sanguo/common/v1/envelope.proto",
    "sanguo/account/v1/account.proto",
    "sanguo/world/v1/world.proto",
    "sanguo/domestic/v1/domestic.proto",
    "sanguo/military/v1/military.proto",
    "sanguo/chat/v1/chat.proto",
    "sanguo/guild/v1/guild.proto",
    "sanguo/rank/v1/rank.proto",
    "sanguo/quest/v1/quest.proto",
    "sanguo/shop/v1/shop.proto",
  ];
  for (const f of files) {
    protobuf.parse(fs.readFileSync(path.join(protoRoot, f), "utf8"), root, { keepCase: true });
  }
  const clientProtoDir = path.resolve(__dirname, "../proto/sanguo");
  for (const rel of ["content/v1/extra.proto", "hero/v1/hero.proto"]) {
    const p = path.join(clientProtoDir, rel);
    if (fs.existsSync(p)) {
      protobuf.parse(fs.readFileSync(p, "utf8"), root, { keepCase: true });
    }
  }
  root.resolveAll();
  const cityState = root.lookupType("sanguo.domestic.v1.GetCityStateResponse");
  if (!cityState.fields.production_rates) {
    cityState.add(new protobuf.Field("production_rates", 3, "sanguo.common.v1.ResourceWallet"));
  }
  return root;
}

const root = loadRoot();
const T = (name) => root.lookupType(name);

const ClientPacket = T("sanguo.common.v1.ClientPacket");
const ServerPacket = T("sanguo.common.v1.ServerPacket");

const PORT = Number(process.env.MOCK_GATEWAY_PORT || 19090);

/** CLIENT-046 evidence harness: preset applied to each new WebSocket session. */
let evidencePreset = process.env.MOCK_EVIDENCE_PRESET || "default";

function applyEvidencePreset(state, preset) {
  const now = Date.now();
  state.buildings = [{ slot_key: "farm", building_cfg_id: 2, level: 1 }];
  state.dailyQuestsSuppressed = false;
  state.evidenceRecruitQueued = false;
  state.mailListFails = false;

  if (preset === "queue-empty" || preset === "default") {
    return;
  }
  if (preset === "queue-build") {
    state.buildings = [
      { slot_key: "farm", building_cfg_id: 2, level: 2, upgrade_finish_at_ms: now + 3_600_000 },
      { slot_key: "hall", building_cfg_id: 1, level: 3, upgrade_finish_at_ms: now + 7_200_000 },
    ];
    state.bag = { ...state.bag, 2003: 2 };
    return;
  }
  if (preset === "queue-recruit") {
    state.evidenceRecruitQueued = true;
    return;
  }
  if (preset === "queue-full") {
    state.buildings = [
      { slot_key: "farm", building_cfg_id: 2, level: 2, upgrade_finish_at_ms: now + 3_600_000 },
    ];
    state.evidenceRecruitQueued = true;
    state.bag = { ...state.bag, 2003: 1 };
    return;
  }
  if (preset === "mail-empty") {
    state.mails = [];
    return;
  }
  if (preset === "mail-empty-unread") {
    state.mails = [
      {
        mail_id: 6100,
        mail_type: 1,
        title: "已读通知",
        body: "无未读邮件时的「未读」筛选空态。",
        status: 1,
        read_at_ms: now - 60_000,
        created_at_ms: now - 120_000,
      },
    ];
    return;
  }
  if (preset === "mail-filter-badge-nine") {
    state.mails = Array.from({ length: 10 }, (_, i) => ({
      mail_id: 7000 + i,
      mail_type: 1,
      title: `未读样本 ${i + 1}`,
      body: "CLIENT-136 count 9 / 9+ evidence",
      status: 0,
      created_at_ms: now - (10 - i) * 1000,
    }));
    state.nextMailId = 7010;
    return;
  }
  if (preset === "mail-filter-badge-count-nine") {
    state.mails = Array.from({ length: 9 }, (_, i) => ({
      mail_id: 7200 + i,
      mail_type: 1,
      title: `未读九封 ${i + 1}`,
      body: "CLIENT-137 count=9 evidence",
      status: 0,
      created_at_ms: now - (9 - i) * 1000,
    }));
    state.nextMailId = 7209;
    return;
  }
  if (preset === "mail-unread-multi") {
    state.mails = [
      {
        mail_id: 6001,
        mail_type: 1,
        title: "欢迎奖励",
        body: "mock 网关演示邮件，可领取谷袋。",
        status: 0,
        attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
        created_at_ms: now - 30_000,
      },
      {
        mail_id: 6002,
        mail_type: 2,
        title: "系统公告",
        body: "第二条未读，无附件。",
        status: 0,
        created_at_ms: now - 10_000,
      },
      {
        mail_id: 6003,
        mail_type: 1,
        title: "已领取样本",
        body: "附件已领，用于对比领取按钮隐藏。",
        status: 2,
        attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
        claimed_at_ms: now - 5_000,
        created_at_ms: now - 90_000,
      },
    ];
    state.nextMailId = 6004;
    return;
  }
  if (preset === "mail-read-no-claim") {
    state.mails = [
      {
        mail_id: 6200,
        mail_type: 2,
        title: "已读无附件",
        body: "选中后不应显示领取附件按钮。",
        status: 1,
        read_at_ms: now - 1_000,
        created_at_ms: now - 60_000,
      },
    ];
    return;
  }
  if (preset === "mail-list-error") {
    state.mailListFails = true;
    return;
  }
  if (preset === "daily-empty") {
    state.dailyQuestsSuppressed = true;
    state.quests = {};
    return;
  }
  if (preset === "daily-claimable") {
    state.quests[1012] = {
      quest_cfg_id: 1012,
      quest_code: "daily_food_1",
      chain_id: 400,
      state: 3,
      progress_current: 5000,
      progress_target: 5000,
    };
    return;
  }
  if (preset === "daily-claimed") {
    state.quests[1012] = {
      quest_cfg_id: 1012,
      quest_code: "daily_food_1",
      chain_id: 400,
      state: 4,
      progress_current: 5000,
      progress_target: 5000,
    };
    return;
  }
  if (preset === "bag-empty") {
    state.bag = {};
    return;
  }
  if (preset === "bag-stacks") {
    state.bag = { 2001: 5, 2003: 2, 2020: 1 };
    return;
  }
  if (preset === "bag-use-fail") {
    state.bag = { 2001: 1 };
    return;
  }
  if (preset === "hero-panel-roster") {
    state.heroes = [
      { hero_id: 8001, template_cfg_id: 1001, level: 12, loyalty: 88 },
      { hero_id: 8002, template_cfg_id: 1002, level: 8, loyalty: 72 },
      { hero_id: 8003, template_cfg_id: 1001, level: 3, loyalty: 65 },
    ];
    return;
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/_evidence/preset") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body || "{}");
        if (typeof parsed.preset === "string") evidencePreset = parsed.preset;
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, preset: evidencePreset }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: "invalid json" }));
      }
    });
    return;
  }
  if (req.method === "GET" && req.url === "/_evidence/preset") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ preset: evidencePreset }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("sanguo mock gateway (WebSocket /ws)\n");
});

const wss = new WebSocketServer({ server, path: "/ws" });

function sessionState() {
  const state = {
    serverId: 1,
    sessionId: "",
    wallet: { food: 5000, wood: 3200, iron: 800, stone: 600, gold: 120 },
    troops: { 1: 0 },
    cityId: 501,
    buildings: [{ slot_key: "farm", building_cfg_id: 2, level: 1 }],
    dailyQuestsSuppressed: false,
    evidenceRecruitQueued: false,
    nextMarchId: 1,
    marches: [],
    nextReportId: 9001,
    reports: [],
    chatMessages: [],
    nextChatId: 1,
    chatMutedUntilMs: 0,
    guild: null,
    nextGuildId: 7001,
    rankEntries: [
      { rank: 1, entity_id: 10001, display_name: "演示君主", score: 12800 },
      { rank: 2, entity_id: 10002, display_name: "路人甲", score: 9200 },
    ],
    bag: { 2004: 2 },
    quests: {},
    shopPurchased: {},
    heroes: [],
    nextHeroId: 8001,
    mails: [
      {
        mail_id: 6001,
        mail_type: 1,
        title: "欢迎奖励",
        body: "mock 网关演示邮件，可领取谷袋。",
        status: 0,
        attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
        created_at_ms: Date.now(),
      },
    ],
    nextMailId: 6002,
    mailListFails: false,
  };
  applyEvidencePreset(state, evidencePreset);
  return state;
}

/** protobufjs decodes proto int64 as Long; normalize before comparing to JS numbers. */
function decodeInt64(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

const HERO_TEMPLATE_DETAIL_META = {
  1001: { template_name: "刘备", template_code: "xuan_de_lord" },
  1002: { template_name: "关羽", template_code: "green_dragon" },
};

function mockHeroDetailPayload(row) {
  const meta =
    HERO_TEMPLATE_DETAIL_META[row.template_cfg_id] ?? {
      template_name: "演示将领",
      template_code: `tpl_${row.template_cfg_id}`,
    };
  const level = row.level ?? 1;
  const loyalty = row.loyalty ?? 50;
  return {
    hero_id: row.hero_id,
    template_cfg_id: row.template_cfg_id,
    template_name: meta.template_name,
    template_code: meta.template_code,
    rarity: 5,
    level,
    loyalty,
    loyalty_min: 0,
    loyalty_max: 100,
    attributes: {
      force: 62 + level,
      intel: 58 + Math.floor(level / 2),
      politics: 55 + Math.floor(level / 3),
      command: 60 + Math.floor(level / 2),
    },
  };
}

function bagList(state) {
  return Object.entries(state.bag).map(([id, qty]) => ({
    item_cfg_id: Number(id),
    quantity: qty,
  }));
}

function addBag(state, itemCfgId, qty) {
  state.bag[itemCfgId] = (state.bag[itemCfgId] ?? 0) + qty;
}

function useMockConsumable(state, itemCfgId, count) {
  const have = state.bag[itemCfgId] ?? 0;
  if (have < count) throw new Error("道具不足");
  let effectSummary = "";
  let speedupSeconds = 0;
  if (itemCfgId === 2001) {
    state.wallet.food += 1000 * count;
    effectSummary = `获得粮食 ${1000 * count}`;
  } else if (itemCfgId === 2003) {
    speedupSeconds = 300 * count;
    effectSummary = `加速 ${speedupSeconds} 秒（占位）`;
  } else {
    effectSummary = "已消耗道具";
  }
  const remaining = have - count;
  if (remaining <= 0) delete state.bag[itemCfgId];
  else state.bag[itemCfgId] = remaining;
  return { remaining: remaining > 0 ? remaining : 0, effectSummary, speedupSeconds };
}

wss.on("connection", (ws) => {
  const state = sessionState();

  ws.on("message", (raw) => {
    try {
      const cp = ClientPacket.decode(raw);
      const route = cp.route;

      if (route === "account.v1.Register") {
        replyOk(ws, cp.trace_id, T("sanguo.account.v1.RegisterResponse"), { account_id: 1 });
        return;
      }

      if (route === "account.v1.ListGameServers") {
        replyOk(ws, cp.trace_id, T("sanguo.account.v1.ListGameServersResponse"), {
          total_count: 2,
          servers: [
            {
              shard: { server_id: 1, display_name: "Mock S1", status: 1 },
              online_count: 42,
              has_player: true,
            },
            {
              shard: { server_id: 2, display_name: "Mock S2", status: 1 },
              online_count: 8,
              has_player: false,
            },
          ],
        });
        return;
      }

      if (route === "account.v1.Login") {
        const req = T("sanguo.account.v1.LoginRequest").decode(cp.payload);
        if (req.login_name !== "demo" || req.password !== "demo123") {
          reply(ws, cp.trace_id, 20001, "账号或密码错误");
          return;
        }
        state.serverId = req.server_id;
        state.sessionId = "00000000-0000-4000-8000-000000000001";
        replyOk(ws, cp.trace_id, T("sanguo.account.v1.LoginResponse"), {
          session_id: state.sessionId,
          player: {
            server_id: req.server_id,
            player_id: 10001,
            display_name: "演示君主",
            level: 3,
            power: 12800,
          },
          wallet: state.wallet,
          session_expires_at_ms: Date.now() + 86400_000,
        });
        return;
      }

      if (route === "account.v1.EnterGameServer") {
        const req = T("sanguo.account.v1.EnterGameServerRequest").decode(cp.payload);
        state.serverId = req.server_id;
        replyOk(ws, cp.trace_id, T("sanguo.account.v1.EnterGameServerResponse"), {
          session_id: state.sessionId,
          server_id: req.server_id,
          player: {
            server_id: req.server_id,
            player_id: 10001,
            display_name: "演示君主",
            level: 3,
            power: 12800,
          },
          wallet: state.wallet,
          session_expires_at_ms: Date.now() + 86400_000,
        });
        return;
      }

      if (route === "world.v1.ListPlayerCities") {
        replyOk(ws, cp.trace_id, T("sanguo.world.v1.ListPlayerCitiesResponse"), {
          cities: [{ city_id: state.cityId, name: "主城", x: 60, y: 60, is_capital: true }],
        });
        return;
      }

      if (route === "world.v1.CreateCity") {
        replyOk(ws, cp.trace_id, T("sanguo.world.v1.CreateCityResponse"), {
          city: { city_id: state.cityId, name: "主城", is_capital: true },
        });
        return;
      }

      if (route === "domestic.v1.GetCityState") {
        replyOk(ws, cp.trace_id, T("sanguo.domestic.v1.GetCityStateResponse"), {
          wallet: state.wallet,
          buildings: state.buildings ?? [{ slot_key: "farm", building_cfg_id: 2, level: 1 }],
          production_rates: state.productionRates ?? { food: 120, wood: 100, iron: 40, stone: 80 },
        });
        return;
      }

      if (route === "chat.v1.SendChatMessage") {
        const req = T("sanguo.chat.v1.SendChatMessageRequest").decode(cp.payload);
        if (req.content === "__mock_mute__") {
          state.chatMutedUntilMs = Date.now() + 5 * 60 * 1000;
          const msg = {
            message_id: state.nextChatId++,
            server_id: req.server_id,
            channel: req.channel,
            sender_player_id: 10001,
            sender_display_name: "演示君主",
            recipient_player_id: req.recipient_player_id,
            guild_id: req.guild_id,
            content: "（mock：已模拟禁言 5 分钟，再发消息将返回 code=61006）",
            sent_at_ms: Date.now(),
          };
          state.chatMessages.push(msg);
          replyOk(ws, cp.trace_id, T("sanguo.chat.v1.SendChatMessageResponse"), { message: msg });
          return;
        }
        if (state.chatMutedUntilMs > Date.now()) {
          reply(ws, cp.trace_id, 61006, "player muted");
          return;
        }
        if (req.channel === 3 && (!state.guild || req.guild_id !== state.guild.guild_id)) {
          reply(ws, cp.trace_id, 61005, "chat: guild required");
          return;
        }
        const msg = {
          message_id: state.nextChatId++,
          server_id: req.server_id,
          channel: req.channel,
          sender_player_id: 10001,
          sender_display_name: "演示君主",
          recipient_player_id: req.recipient_player_id,
          guild_id: req.guild_id,
          content: req.content,
          sent_at_ms: Date.now(),
        };
        state.chatMessages.push(msg);
        replyOk(ws, cp.trace_id, T("sanguo.chat.v1.SendChatMessageResponse"), { message: msg });
        return;
      }

      if (route === "chat.v1.ListChatMessages") {
        const req = T("sanguo.chat.v1.ListChatMessagesRequest").decode(cp.payload);
        const filtered = state.chatMessages.filter((m) => {
          if (m.channel !== req.channel) return false;
          if (req.channel === 2 && req.peer_player_id) {
            return (
              m.recipient_player_id === req.peer_player_id || m.sender_player_id === req.peer_player_id
            );
          }
          if (req.channel === 3 && req.guild_id) {
            return m.guild_id === req.guild_id;
          }
          return true;
        });
        replyOk(ws, cp.trace_id, T("sanguo.chat.v1.ListChatMessagesResponse"), { messages: filtered });
        return;
      }

      if (route === "guild.v1.CreateGuild") {
        const req = T("sanguo.guild.v1.CreateGuildRequest").decode(cp.payload);
        if (state.guild) {
          reply(ws, cp.trace_id, 60002, "already in a guild");
          return;
        }
        state.guild = {
          guild_id: state.nextGuildId++,
          server_id: req.server_id,
          name: req.name,
          leader_player_id: 10001,
          member_count: 1,
          member_limit: 50,
          created_at_ms: Date.now(),
          members: [
            {
              player_id: 10001,
              display_name: "演示君主",
              role: 1,
              joined_at_ms: Date.now(),
              power: 12800,
            },
          ],
        };
        replyOk(ws, cp.trace_id, T("sanguo.guild.v1.CreateGuildResponse"), { guild: state.guild });
        return;
      }

      if (route === "guild.v1.JoinGuild") {
        const req = T("sanguo.guild.v1.JoinGuildRequest").decode(cp.payload);
        if (!state.guild || state.guild.guild_id !== req.guild_id) {
          reply(ws, cp.trace_id, 60001, "军团不存在");
          return;
        }
        state.guild.member_count = 2;
        state.guild.members.push({
          player_id: 10001,
          display_name: "演示君主",
          role: 3,
          joined_at_ms: Date.now(),
          power: 12800,
        });
        replyOk(ws, cp.trace_id, T("sanguo.guild.v1.JoinGuildResponse"), { guild: state.guild });
        return;
      }

      if (route === "guild.v1.ListGuildMembers") {
        const req = T("sanguo.guild.v1.ListGuildMembersRequest").decode(cp.payload);
        if (!state.guild || state.guild.guild_id !== req.guild_id) {
          reply(ws, cp.trace_id, 60001, "军团不存在");
          return;
        }
        replyOk(ws, cp.trace_id, T("sanguo.guild.v1.ListGuildMembersResponse"), {
          guild: state.guild,
          members: state.guild.members,
          total_count: state.guild.members.length,
        });
        return;
      }

      if (route === "rank.v1.GetLeaderboard") {
        const req = T("sanguo.rank.v1.GetLeaderboardRequest").decode(cp.payload);
        const lbType = req.type ?? 1;
        const powerEntries = state.rankEntries;
        const resourceEntries = [
          { rank: 1, entity_id: 10003, display_name: "富贾", score: 25000 },
          { rank: 2, entity_id: 10001, display_name: "演示君主", score: 19800 },
        ];
        const entries = lbType === 2 ? resourceEntries : powerEntries;
        replyOk(ws, cp.trace_id, T("sanguo.rank.v1.GetLeaderboardResponse"), {
          type: lbType,
          entries,
          total_count: entries.length,
          my_rank: lbType === 2 ? 0 : 1,
          my_score: lbType === 2 ? 12000 : 12800,
          snapshot_version: lbType === 2 ? 4 : 2,
          snapshot_refreshed_at_ms: Date.now(),
        });
        return;
      }

      if (route === "military.v1.RecruitTroop") {
        const req = T("sanguo.military.v1.RecruitTroopRequest").decode(cp.payload);
        const cost = 10 * req.count;
        state.wallet.food = Math.max(0, state.wallet.food - cost);
        if (state.evidenceRecruitQueued) {
          const finishAt = Date.now() + 180_000;
          const queueId = 9101;
          replyOk(ws, cp.trace_id, T("sanguo.military.v1.RecruitTroopResponse"), {
            troop: { unit_cfg_id: req.unit_cfg_id, count: state.troops[req.unit_cfg_id] ?? 0 },
            wallet: state.wallet,
            queue_id: queueId,
            finish_at_ms: finishAt,
          });
          return;
        }
        state.troops[req.unit_cfg_id] = (state.troops[req.unit_cfg_id] ?? 0) + req.count;
        replyOk(ws, cp.trace_id, T("sanguo.military.v1.RecruitTroopResponse"), {
          troop: { unit_cfg_id: req.unit_cfg_id, count: state.troops[req.unit_cfg_id] },
          wallet: state.wallet,
          queue_id: 0,
          finish_at_ms: 0,
        });
        return;
      }

      if (route === "military.v1.StartMarch") {
        const req = T("sanguo.military.v1.StartMarchRequest").decode(cp.payload);
        for (const t of req.troops ?? []) {
          state.troops[t.unit_cfg_id] = Math.max(0, (state.troops[t.unit_cfg_id] ?? 0) - t.count);
        }
        const now = Date.now();
        const march = {
          march_id: state.nextMarchId++,
          origin_city_id: req.city_id,
          from_x: 0,
          from_y: 0,
          to_x: req.to_x,
          to_y: req.to_y,
          purpose: req.purpose,
          phase: 2,
          depart_at_ms: now,
          arrive_at_ms: now + 120_000,
          troops: req.troops,
        };
        state.marches.unshift(march);
        replyOk(ws, cp.trace_id, T("sanguo.military.v1.StartMarchResponse"), {
          march,
          city_troops: Object.entries(state.troops).map(([id, count]) => ({
            unit_cfg_id: Number(id),
            count,
          })),
        });
        return;
      }

      if (route === "military.v1.ListMarches") {
        const req = T("sanguo.military.v1.ListMarchesRequest").decode(cp.payload);
        let marches = state.marches ?? [];
        if (req.city_id) {
          marches = marches.filter((m) => m.origin_city_id === req.city_id);
        }
        const total = marches.length;
        const offset = req.offset ?? 0;
        const limit = req.limit > 0 ? req.limit : 20;
        const slice = marches.slice(offset, offset + limit);
        replyOk(ws, cp.trace_id, T("sanguo.military.v1.ListMarchesResponse"), {
          marches: slice,
          total,
        });
        return;
      }

      if (route === "military.v1.ListBattleReports") {
        replyOk(ws, cp.trace_id, T("sanguo.military.v1.ListBattleReportsResponse"), {
          reports: state.reports,
          total: state.reports.length,
        });
        return;
      }

      if (route === "military.v1.GetBattleReport") {
        const req = T("sanguo.military.v1.GetBattleReportRequest").decode(cp.payload);
        const summary = state.reports.find((r) => r.report_id === decodeInt64(req.report_id));
        replyOk(ws, cp.trace_id, T("sanguo.military.v1.GetBattleReportResponse"), {
          report: {
            summary,
            detail: {
              result: "attacker_win",
              rounds: [{ round: 1, attacker_to_def_hp: 10, defender_to_att_hp: 5 }],
              attacker_casualties: { infantry: 2 },
              defender_casualties: { infantry: 8 },
            },
          },
        });
        return;
      }

      if (route === "quest.v1.ListPlayerQuests") {
        const req = T("sanguo.quest.v1.ListPlayerQuestsRequest").decode(cp.payload);
        const chainFilter = req.chain_id ?? 0;
        const rows = Object.values(state.quests).filter(
          (q) => !chainFilter || (q.chain_id ?? 0) === chainFilter,
        );
        const defaults = [];
        if (!rows.length && chainFilter === 400 && state.dailyQuestsSuppressed) {
          replyOk(ws, cp.trace_id, T("sanguo.quest.v1.ListPlayerQuestsResponse"), { quests: [] });
          return;
        }
        if (!rows.length) {
          if (chainFilter === 400) {
            defaults.push({
              quest_cfg_id: 1012,
              quest_code: "daily_food_1",
              chain_id: 400,
              state: 1,
              progress_current: 0,
              progress_target: 5000,
            });
          } else if (!chainFilter || chainFilter === 100) {
            defaults.push({
              quest_cfg_id: 1001,
              quest_code: "tutorial_build_hall",
              chain_id: 100,
              state: 1,
              progress_current: 0,
              progress_target: 2,
            });
          }
        }
        replyOk(ws, cp.trace_id, T("sanguo.quest.v1.ListPlayerQuestsResponse"), {
          quests: rows.length ? rows : defaults,
        });
        return;
      }

      if (route === "quest.v1.AcceptQuest") {
        const req = T("sanguo.quest.v1.AcceptQuestRequest").decode(cp.payload);
        const isDaily = req.quest_cfg_id >= 1012 && req.quest_cfg_id < 1100;
        const row = {
          quest_cfg_id: req.quest_cfg_id,
          quest_code: isDaily ? "daily_food_1" : "tutorial_build_hall",
          chain_id: isDaily ? 400 : 100,
          state: 2,
          progress_current: 0,
          progress_target: isDaily ? 5000 : 2,
        };
        state.quests[req.quest_cfg_id] = row;
        replyOk(ws, cp.trace_id, T("sanguo.quest.v1.AcceptQuestResponse"), { quest: row });
        return;
      }

      if (route === "quest.v1.ReportQuestProgress") {
        const req = T("sanguo.quest.v1.ReportQuestProgressRequest").decode(cp.payload);
        const row = state.quests[req.quest_cfg_id] ?? {
          quest_cfg_id: req.quest_cfg_id,
          quest_code: "tutorial_build_hall",
          state: 2,
          progress_target: 2,
        };
        row.progress_current = req.progress_value;
        row.state = row.progress_current >= (row.progress_target ?? 2) ? 3 : 2;
        state.quests[req.quest_cfg_id] = row;
        replyOk(ws, cp.trace_id, T("sanguo.quest.v1.ReportQuestProgressResponse"), { quest: row });
        return;
      }

      if (route === "quest.v1.ClaimQuestReward") {
        const req = T("sanguo.quest.v1.ClaimQuestRewardRequest").decode(cp.payload);
        addBag(state, 2001, 1);
        const row = state.quests[req.quest_cfg_id] ?? { quest_cfg_id: req.quest_cfg_id };
        row.state = 4;
        row.progress_current = row.progress_target ?? 2;
        state.quests[req.quest_cfg_id] = row;
        replyOk(ws, cp.trace_id, T("sanguo.quest.v1.ClaimQuestRewardResponse"), {
          quest: row,
          granted_rewards: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
        });
        return;
      }

      if (route === "shop.v1.ListShopShelf") {
        replyOk(ws, cp.trace_id, T("sanguo.shop.v1.ListShopShelfResponse"), {
          catalog_version: 1,
          offers: [
            {
              offer_id: 1001,
              shelf_id: 1,
              shelf_name: "每日特惠",
              item_cfg_id: 2001,
              quantity_per_purchase: 1,
              price_resources: { gold: 10 },
              purchase_limit: 3,
              purchased_count: state.shopPurchased[1001] ?? 0,
            },
          ],
        });
        return;
      }

      if (route === "shop.v1.PurchaseShopOffer") {
        const req = T("sanguo.shop.v1.PurchaseShopOfferRequest").decode(cp.payload);
        const count = req.purchase_count || 1;
        const cost = 10 * count;
        if ((state.wallet.gold ?? 0) < cost) {
          reply(ws, cp.trace_id, 64003, "余额不足");
          return;
        }
        state.wallet.gold -= cost;
        addBag(state, 2001, count);
        state.shopPurchased[req.offer_id] = (state.shopPurchased[req.offer_id] ?? 0) + count;
        replyOk(ws, cp.trace_id, T("sanguo.shop.v1.PurchaseShopOfferResponse"), {
          offer: {
            offer_id: req.offer_id,
            purchased_count: state.shopPurchased[req.offer_id],
            price_resources: { gold: 10 },
          },
          granted_items: { items: [{ item_cfg_id: 2001, quantity: count }] },
          wallet_after: state.wallet,
        });
        return;
      }

      if (route === "content.v1.ListPlayerBag") {
        replyOk(ws, cp.trace_id, T("sanguo.content.v1.ListPlayerBagResponse"), {
          items: bagList(state),
        });
        return;
      }

      if (route === "content.v1.UseConsumable") {
        const req = T("sanguo.content.v1.UseConsumableRequest").decode(cp.payload);
        try {
          const { remaining, effectSummary, speedupSeconds } = useMockConsumable(
            state,
            req.item_cfg_id,
            req.count || 1,
          );
          replyOk(ws, cp.trace_id, T("sanguo.content.v1.UseConsumableResponse"), {
            item_cfg_id: req.item_cfg_id,
            remaining,
            wallet_after: state.wallet,
            speedup_seconds: speedupSeconds,
            effect_summary: effectSummary,
          });
        } catch (e) {
          reply(ws, cp.trace_id, 10001, e.message);
        }
        return;
      }

      if (route === "hero.v1.ListRecruitTemplates") {
        const owned = new Set(state.heroes.map((h) => h.template_cfg_id));
        const templates = [
          {
            template_cfg_id: 1001,
            template_name: "刘备",
            template_code: "xuan_de_lord",
            pool: "standard",
            rarity: 5,
            recruit_cost: { food: 5000, wood: 5000, stone: 3000, iron: 2000 },
            recruit_item: { item_cfg_id: 2004, quantity: 1 },
            already_owned: owned.has(1001),
          },
          {
            template_cfg_id: 1002,
            template_name: "关羽",
            template_code: "green_dragon",
            pool: "elite",
            rarity: 5,
            recruit_cost: { food: 8000, wood: 6000, stone: 4000, iron: 3000 },
            recruit_item: { item_cfg_id: 2004, quantity: 1 },
            already_owned: owned.has(1002),
          },
        ];
        replyOk(ws, cp.trace_id, T("sanguo.hero.v1.ListRecruitTemplatesResponse"), {
          templates,
          total_count: templates.length,
        });
        return;
      }

      if (route === "hero.v1.ListPlayerHeroes") {
        replyOk(ws, cp.trace_id, T("sanguo.hero.v1.ListPlayerHeroesResponse"), {
          heroes: state.heroes,
          total_count: state.heroes.length,
        });
        return;
      }

      if (route === "hero.v1.GetHeroDetail") {
        const req = T("sanguo.hero.v1.GetHeroDetailRequest").decode(cp.payload);
        const heroId = decodeInt64(req.hero_id);
        const h = state.heroes.find((x) => x.hero_id === heroId);
        if (!h) {
          reply(ws, cp.trace_id, 10001, "hero not found");
          return;
        }
        replyOk(ws, cp.trace_id, T("sanguo.hero.v1.GetHeroDetailResponse"), mockHeroDetailPayload(h));
        return;
      }

      if (route === "hero.v1.RecruitHero") {
        const req = T("sanguo.hero.v1.RecruitHeroRequest").decode(cp.payload);
        const scrollId = req.item_cfg_id || 2004;
        const have = state.bag[scrollId] ?? 0;
        if (have < 1) {
          reply(ws, cp.trace_id, 10001, "道具不足");
          return;
        }
        state.bag[scrollId] = have - 1;
        const heroId = state.nextHeroId++;
        const row = {
          hero_id: heroId,
          template_cfg_id: req.template_cfg_id || 1001,
          level: 1,
          loyalty: 100,
        };
        state.heroes.push(row);
        replyOk(ws, cp.trace_id, T("sanguo.hero.v1.RecruitHeroResponse"), row);
        return;
      }

      if (route === "content.v1.ListPlayerMail") {
        if (state.mailListFails) {
          reply(ws, cp.trace_id, 40010, "收件箱暂不可用（mock 错误态）");
          return;
        }
        const req = T("sanguo.content.v1.ListPlayerMailRequest").decode(cp.payload);
        let mails = state.mails;
        const filter = req.filter ?? 0;
        if (filter === 1) mails = mails.filter((x) => (x.status ?? 0) === 0);
        else if (filter === 2) mails = mails.filter((x) => (x.status ?? 0) !== 0);
        const pageSize = req.page_size > 0 ? req.page_size : 50;
        const offset = req.page_offset ?? 0;
        const total = mails.length;
        mails = mails.slice(offset, offset + pageSize);
        replyOk(ws, cp.trace_id, T("sanguo.content.v1.ListPlayerMailResponse"), {
          mails,
          total_count: total,
        });
        return;
      }

      if (route === "content.v1.MarkPlayerMailRead") {
        const req = T("sanguo.content.v1.MarkPlayerMailReadRequest").decode(cp.payload);
        const m = state.mails.find((x) => x.mail_id === decodeInt64(req.mail_id));
        if (!m) {
          reply(ws, cp.trace_id, 10001, "mail not found");
          return;
        }
        m.status = 1;
        m.read_at_ms = Date.now();
        replyOk(ws, cp.trace_id, T("sanguo.content.v1.MarkPlayerMailReadResponse"), { mail: m });
        return;
      }

      if (route === "content.v1.ClaimPlayerMailAttachments") {
        const req = T("sanguo.content.v1.ClaimPlayerMailAttachmentsRequest").decode(cp.payload);
        const m = state.mails.find((x) => x.mail_id === decodeInt64(req.mail_id));
        if (!m) {
          reply(ws, cp.trace_id, 10001, "mail not found");
          return;
        }
        if (m.status === 2) {
          reply(ws, cp.trace_id, 10001, "already claimed");
          return;
        }
        const items = m.attachments?.items ?? [];
        for (const it of items) {
          addBag(state, it.item_cfg_id, it.quantity || 1);
        }
        const res = m.attachments?.resources;
        if (res?.food) state.wallet.food += res.food;
        if (res?.gold) state.wallet.gold += res.gold;
        m.status = 2;
        m.claimed_at_ms = Date.now();
        replyOk(ws, cp.trace_id, T("sanguo.content.v1.ClaimPlayerMailAttachmentsResponse"), {
          mail: m,
          granted: m.attachments,
          wallet_after: state.wallet,
          bag_items: bagList(state),
        });
        return;
      }

      reply(ws, cp.trace_id, 10001, `mock: unsupported route ${route}`);
    } catch {
      reply(ws, "", 10001, "invalid packet");
    }
  });
});

function reply(ws, traceId, code, msg, data = Buffer.alloc(0)) {
  const sp = ServerPacket.encode(ServerPacket.create({ code, msg, data, trace_id: traceId })).finish();
  ws.send(sp);
}

function replyOk(ws, traceId, ResponseType, fields) {
  const data = ResponseType.encode(ResponseType.create(fields)).finish();
  reply(ws, traceId, 0, "", data);
}

server.listen(PORT, () => {
  console.log(`mock gateway ws://127.0.0.1:${PORT}/ws`);
});
