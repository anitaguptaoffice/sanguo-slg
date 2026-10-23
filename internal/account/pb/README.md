# 生成说明

从 `spec/proto` 生成账号域 protobuf（勿手改 `*.pb.go`）：

```bash
protoc -I spec/proto \
  --go_out=internal/account/pb --go_opt=paths=source_relative \
  --go_opt=Msanguo/common/v1/types.proto=github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1 \
  spec/proto/sanguo/common/v1/types.proto \
  spec/proto/sanguo/account/v1/account.proto
```
