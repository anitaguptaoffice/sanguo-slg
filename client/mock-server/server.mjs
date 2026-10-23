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

const PORT = Number(process.env.MOCK_GATEWAY_PORT || 19090);

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("sanguo mock gateway (WebSocket /ws)\n");
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    try {
      const cp = ClientPacket.decode(raw);
      if (cp.route !== "account.v1.Login") {
        reply(ws, cp.trace_id, 10001, "unknown route");
        return;
      }
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
          wallet: { food: 5000, wood: 3200, iron: 800, stone: 600, gold: 120 },
          session_expires_at_ms: Date.now() + 86400_000,
        }),
      ).finish();
      reply(ws, cp.trace_id, 0, "", data);
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
