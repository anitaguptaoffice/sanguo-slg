# 通信协议（SPEC-002）

H5 客户端经 **WebSocket 二进制帧** 收发 **Protobuf 3** 消息。契约真源在本目录；生成代码输出到仓库根 `gen/`（不提交），由 `protoc` 生成。

待独立评审：[行军已回城终态与兼容门禁](MARCH-RETURNED.md)（SPEC-MARCH-RETURNED-001；不代表消费者已实现）。

## 分包

| 路径 | 域 | 主要 route |
|------|-----|---------|
| `sanguo/common/v1/` | 公共 | 帧封装、`ErrorCode`、共享 DTO |
| `sanguo/account/v1/` | 账号 | `Login`、`Register`、`RefreshSession`、`ListGameServers`、`EnterGameServer` |
| `sanguo/world/v1/` | 世界 | `ListPlayerCities`、`CreateCity` |
| `sanguo/domestic/v1/` | 内政 | `StartBuildingUpgrade`、`GetCityState` |
| `sanguo/military/v1/` | 军事 | `RecruitTroop`、`StartMarch`、`ListMarches`、`GetBattleReport`、`ListBattleReports` |
| `sanguo/guild/v1/` | 军团 | `CreateGuild`、`JoinGuild`、`LeaveGuild`、`ListGuildMembers` |
| `sanguo/chat/v1/` | 聊天 | `SendChatMessage`、`ListChatMessages` |
| `sanguo/rank/v1/` | 排行 | `GetLeaderboard` |
| `sanguo/quest/v1/` | 任务 | `ListPlayerQuests`、`AcceptQuest`、`ReportQuestProgress`、`ClaimQuestReward`、`GetQuestChainStatus` |
| `sanguo/shop/v1/` | 商城 | `ListShopShelf`、`PurchaseShopOffer` |
| `sanguo/gm/v1/` | 运营 GM | `LookupPlayer`、`GrantReward`、`MutePlayer`、`KickPlayer` |

## WebSocket 约定

1. 一帧一条 `ClientPacket`（上行）；服务端回一条 `ServerPacket`（下行）。
2. `ClientPacket.route` 与请求消息类型一一对应，命名：`<domain>.v1.<Method>`，例如 `account.v1.Login`。
3. `ClientPacket.payload` 为对应 `*Request` 的 protobuf 序列化；鉴权会话放在 `session_id`（登录接口除外）。进服后 `server_id` 与账号会话绑定，后续请求应携带并与服务端校验一致。
4. 统一响应包 **`ServerPacket`**：`code` / `msg` / `data`。
   - `code == 0` 表示成功；`data` 为对应 `*Response` 的序列化。
   - `code != 0` 时 `data` 通常为空，`msg` 为可读说明；数值与 `ErrorCode` 枚举一致。
5. 时间字段统一 **Unix 毫秒**（`int64`），与 H5 `Date` 互转方便。

## 错误码分段

| 区间 | 域 |
|------|-----|
| `0` | 成功 |
| `10000–10999` | 公共 / 网关 |
| `20000–20999` | 账号 `account` |
| `30000–30999` | 世界 `world` |
| `40000–40999` | 内政 `domestic` |
| `50000–50999` | 军事 `military` |
| `60000–60999` | 军团 `guild` |
| `61000–61999` | 聊天 `chat` |
| `62000–62999` | 排行 `rank` |
| `63000–63999` | 任务 `quest` |
| `64000–64999` | 商城 `shop` |
| `65000–65999` | 运营 `gm` |

新增错误在对应域 proto 内扩展枚举值，并保持数值落在上表区间内。

GM 消息可由 `cmd/gm` 或独立 HTTP 入口承载，仍使用相同 `*Request`/`*Response` 形状与 `ErrorCode` 分段；鉴权使用运营 token，不走玩家 `session_id`。

## 字段命名

与 `spec/db/` DDL 对齐：`server_id`、`player_id`、`city_id`、`slot_key`、`building_cfg_id`、`unit_cfg_id` 等。

## 校验

```bash
./spec/proto/validate.sh
```

依赖系统已安装的 `protoc`（Protobuf 3）。可选生成 Go 代码示例：

```bash
protoc -I spec/proto --go_out=gen/go spec/proto/sanguo/**/*.proto
```

（实现阶段在 CI 中挂接代码生成；本卡仅校验 `.proto` 语法与 import。）
