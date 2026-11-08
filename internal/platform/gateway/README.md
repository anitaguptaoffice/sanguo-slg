# WebSocket 网关（PLAT-002）

无状态边缘：WebSocket 升级、会话鉴权、`gateway.v1.Ping` 心跳、同 `session_id` 重连踢旧连接、按连接限流、IP 黑白名单。业务通过 `RouteHandler` 注册；帧格式为 `spec/proto` 的 `ClientPacket` / `ServerPacket`（生成代码在 `pb/`）。

登录或 `account.v1.EnterGameServer` 后，客户端应在 `ClientPacket.server_id` 携带当前服 ID；装配层（`internal/api` + `internal/platform/shard`）校验与会话绑定一致。M3 路由（聊天/军团/排行）由 `internal/platform/assembly` 派发到各域 handler，域卡未合并前返回 `COMMON_UNAVAILABLE` 占位。

## 挂载

```go
mux := http.NewServeMux()
gateway.Mount(mux, log, gateway.DefaultConfig(), gateway.AccessControl{}, sessions, router)
```

## 校验 proto 生成物

```bash
export PATH="$PATH:$(go env GOPATH)/bin"
protoc -I spec/proto --go_out=internal/platform/gateway/pb --go_opt=paths=source_relative \
  spec/proto/sanguo/common/v1/envelope.proto
```

## 测试

```bash
go test ./internal/platform/gateway/...          # 含 3000 连接压测
go test ./internal/platform/gateway/... -short   # 跳过压测
```

## Canonical ErrorCode binding catch-up (#2344)

The complete generated envelope uses protoc 3.21.12 and protoc-gen-go 1.36.5
(Go 1.23.12), with the command above and the canonical merged #2340 schema.
It restores the 18 QUEST/SHOP/GM values adopted in #76 and adds conflict 50008.
No routes, journal, storage or activation changes are included; Recruit V2 stays off.
The official compiler artifact is run 42496404327, artifact 13623931068,
`candidate/platform-generated.pb.go`, SHA256
`a7518f5a2a853d427f4cbbbd922257f46d6c04341df87996ee7f1e423a83eaab`.
The entire artifact is copied unchanged, including its descriptor.

`go test ./internal/platform/gateway/pb/sanguo/common/v1 -count=1 -v`
checks all 55 canonical values against generated maps/reflection and wire roundtrips,
legacy packet descriptors/byte fixtures, zero defaults, unknown integers and fields.
The same tests against the old generated file must fail the enum cardinality check.
Full gateway tests above remain required; compiler-only diagnostic success is not
behavioral acceptance. Official baseline/fixed results and exact commit mapping
belong to the linked issue/PR; no local Go execution is claimed.
