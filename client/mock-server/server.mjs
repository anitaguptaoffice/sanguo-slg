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
  ];
  for (const f of files) {
    protobuf.parse(fs.readFileSync(path.join(protoRoot, f), "utf8"), root, { keepCase: true });
  }
  root.resolveAll();
  return root;
}

const root = loadRoot();
const T = (name) => root.lookupType(name);

const ClientPacket = T("sanguo.common.v1.ClientPacket");
const ServerPacket = T("sanguo.common.v1.ServerPacket");

const PORT = Number(process.env.MOCK_GATEWAY_PORT || 19090);

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("sanguo mock gateway (WebSocket /ws)\n");
});

const wss = new WebSocketServer({ server, path: "/ws" });

function sessionState() {
  return {
    serverId: 1,
    sessionId: "",
    wallet: { food: 5000, wood: 3200, iron: 800, stone: 600, gold: 120 },
    troops: { 1: 0 },
    cityId: 501,
    nextMarchId: 1,
    nextReportId: 9001,
    reports: [],
    chatMessages: [],
    nextChatId: 1,
    guild: null,
    nextGuildId: 7001,
    rankEntries: [
      { rank: 1, entity_id: 10001, display_name: "演示君主", score: 12800 },
      { rank: 2, entity_id: 10002, display_name: "路人甲", score: 9200 },
    ],
  };
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
          buildings: [{ slot_key: "farm", building_cfg_id: 2, level: 1 }],
        });
        return;
      }

      if (route === "chat.v1.SendChatMessage") {
        const req = T("sanguo.chat.v1.SendChatMessageRequest").decode(cp.payload);
        const msg = {
          message_id: state.nextChatId++,
          server_id: req.server_id,
          channel: req.channel,
          sender_player_id: 10001,
          sender_display_name: "演示君主",
          recipient_player_id: req.recipient_player_id,
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
          return true;
        });
        replyOk(ws, cp.trace_id, T("sanguo.chat.v1.ListChatMessagesResponse"), { messages: filtered });
        return;
      }

      if (route === "guild.v1.CreateGuild") {
        const req = T("sanguo.guild.v1.CreateGuildRequest").decode(cp.payload);
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
        replyOk(ws, cp.trace_id, T("sanguo.rank.v1.GetLeaderboardResponse"), {
          type: 1,
          entries: state.rankEntries,
          total_count: state.rankEntries.length,
          my_rank: 1,
          my_score: 12800,
          snapshot_version: 1,
          snapshot_refreshed_at_ms: Date.now(),
        });
        return;
      }

      if (route === "military.v1.RecruitTroop") {
        const req = T("sanguo.military.v1.RecruitTroopRequest").decode(cp.payload);
        const cost = 10 * req.count;
        state.wallet.food = Math.max(0, state.wallet.food - cost);
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
        replyOk(ws, cp.trace_id, T("sanguo.military.v1.StartMarchResponse"), {
          march: {
            march_id: state.nextMarchId++,
            to_x: req.to_x,
            to_y: req.to_y,
            purpose: req.purpose,
            phase: 2,
            depart_at_ms: now,
            arrive_at_ms: now + 120_000,
            troops: req.troops,
          },
          city_troops: Object.entries(state.troops).map(([id, count]) => ({
            unit_cfg_id: Number(id),
            count,
          })),
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
        const summary = state.reports.find((r) => r.report_id === req.report_id);
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
