# WebSocket 网关（PLAT-002）

无状态边缘：WebSocket 升级、会话鉴权、`gateway.v1.Ping` 心跳、同 `session_id` 重连踢旧连接、按连接限流、IP 黑白名单。业务通过 `RouteHandler` 注册；帧格式为 `spec/proto` 的 `ClientPacket` / `ServerPacket`（生成代码在 `pb/`）。

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
