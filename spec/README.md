# spec

契约目录，所有跨域实现的唯一真源。改动需单独 PR。

```
spec/
├── proto/    通信协议（Protobuf），按域分包
├── db/       数据模型（PostgreSQL DDL + 迁移）
└── rules/    玩法规则（公式、流程、数值区间）
```

## 规则

1. 先改 `spec/`，再改实现。任何实现与 spec 不一致，以 spec 为准。
2. `spec/proto` 与 `spec/db` 的变更需要 review，每周冻结一次。
3. 生成代码放 `gen/`，不提交手改内容。

## 待办

- [ ] SPEC-001 领域模型与 DDL
- [ ] SPEC-002 通信协议
- [ ] SPEC-003 核心规则文档
- [ ] SPEC-004 数值数据管线
