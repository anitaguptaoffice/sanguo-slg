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
  ];
  for (const f of files) {
    protobuf.parse(fs.readFileSync(path.join(protoRoot, f), "utf8"), root, { keepCase: true });
  }
  root.resolveAll();
  return root;
}

const root = loadRoot();
const ClientPacket = root.lookupType("sanguo.common.v1.ClientPacket");
const ServerPacket = root.lookupType("sanguo.common.v1.ServerPacket");
const LoginRequest = root.lookupType("sanguo.account.v1.LoginRequest");
const LoginResponse = root.lookupType("sanguo.account.v1.LoginResponse");
const RecruitTroopRequest = root.lookupType("sanguo.military.v1.RecruitTroopRequest");
const RecruitTroopResponse = root.lookupType("sanguo.military.v1.RecruitTroopResponse");
const StartMarchRequest = root.lookupType("sanguo.military.v1.StartMarchRequest");
const StartMarchResponse = root.lookupType("sanguo.military.v1.StartMarchResponse");
const ListBattleReportsResponse = root.lookupType("sanguo.military.v1.ListBattleReportsResponse");
const GetBattleReportRequest = root.lookupType("sanguo.military.v1.GetBattleReportRequest");
const GetBattleReportResponse = root.lookupType("sanguo.military.v1.GetBattleReportResponse");

const PORT = Number(process.env.MOCK_GATEWAY_PORT || 19090);

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("sanguo mock gateway (WebSocket /ws)\n");
});

const wss = new WebSocketServer({ server, path: "/ws" });

function sessionState() {
  return {
    wallet: { food: 5000, wood: 3200, iron: 800, stone: 600, gold: 120 },
    troops: { 1: 0 },
    nextMarchId: 1,
    nextReportId: 9001,
    reports: [],
  };
}

wss.on("connection", (ws) => {
  const state = sessionState();

  ws.on("message", (raw) => {
    try {
      const cp = ClientPacket.decode(raw);
      const route = cp.route;
      if (route === "account.v1.Login") {
        const req = LoginRequest.decode(cp.payload);
        if (req.login_name !== "demo" || req.password !== "demo123") {
          reply(ws, cp.trace_id, 20001, "账号或密码错误");
          return;
        }
        const data = LoginResponse.encode(
          LoginResponse.create({
            session_id: "00000000-0000-4000-8000-000000000001",
            player: {
              server_id: req.server_id,
              player_id: 10001,
              display_name: "演示君主",
              level: 3,
              power: 12800,
            },
            wallet: state.wallet,
            session_expires_at_ms: Date.now() + 86400_000,
          }),
        ).finish();
        reply(ws, cp.trace_id, 0, "", data);
        return;
      }

      if (route === "military.v1.RecruitTroop") {
        const req = RecruitTroopRequest.decode(cp.payload);
        const cost = 10 * req.count;
        state.wallet.food = Math.max(0, state.wallet.food - cost);
        state.troops[req.unit_cfg_id] = (state.troops[req.unit_cfg_id] ?? 0) + req.count;
        const data = RecruitTroopResponse.encode(
          RecruitTroopResponse.create({
            troop: { unit_cfg_id: req.unit_cfg_id, count: state.troops[req.unit_cfg_id] },
            wallet: state.wallet,
            queue_id: 0,
            finish_at_ms: 0,
          }),
        ).finish();
        reply(ws, cp.trace_id, 0, "", data);
        return;
      }

      if (route === "military.v1.StartMarch") {
        const req = StartMarchRequest.decode(cp.payload);
        for (const t of req.troops ?? []) {
          state.troops[t.unit_cfg_id] = Math.max(0, (state.troops[t.unit_cfg_id] ?? 0) - t.count);
        }
        const now = Date.now();
        const data = StartMarchResponse.encode(
          StartMarchResponse.create({
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
          }),
        ).finish();
        reply(ws, cp.trace_id, 0, "", data);
        return;
      }

      if (route === "military.v1.ListBattleReports") {
        const data = ListBattleReportsResponse.encode(
          ListBattleReportsResponse.create({
            reports: state.reports,
            total: state.reports.length,
          }),
        ).finish();
        reply(ws, cp.trace_id, 0, "", data);
        return;
      }

      if (route === "military.v1.GetBattleReport") {
        const req = GetBattleReportRequest.decode(cp.payload);
        const summary = state.reports.find((r) => r.report_id === req.report_id);
        const data = GetBattleReportResponse.encode(
          GetBattleReportResponse.create({
            report: {
              summary,
              detail: {
                result: "attacker_win",
                rounds: [{ round: 1, attacker_to_def_hp: 10, defender_to_att_hp: 5 }],
                attacker_casualties: { infantry: 2 },
                defender_casualties: { infantry: 8 },
              },
            },
          }),
        ).finish();
        reply(ws, cp.trace_id, 0, "", data);
        return;
      }

      reply(ws, cp.trace_id, 10001, `mock: unsupported route ${route}`);
    } catch {
      reply(ws, "", 10001, "invalid packet");
    }
  });
});

function reply(ws, traceId, code, msg, data = Buffer.alloc(0)) {
  const sp = ServerPacket.encode(
    ServerPacket.create({ code, msg, data, trace_id: traceId }),
  ).finish();
  ws.send(sp);
}

server.listen(PORT, () => {
  console.log(`mock gateway ws://127.0.0.1:${PORT}/ws`);
});
