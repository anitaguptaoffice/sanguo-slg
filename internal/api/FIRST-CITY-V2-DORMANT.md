# API-FIRST-CITY-V2-DORMANT-DISCOVER-001 ([#2541](https://github.com/anitaguptaoffice/sanguo-slg/issues/2541))

Dormant `world.v2.DiscoverFirstCityIntent` / `SubmitFirstCity`; `EnableFirstCityV2Routes` only.
Wire: frozen `spec/proto/sanguo/world/v2/first_city.proto`; Go codec: `internal/api/pb/sanguo/world/v1/first_city_v2.pb.go` (`worldv1`, PG inventory).

Regenerate binding (protoc 3.21.12, protoc-gen-go 1.36.5):

```sh
protoc -I spec/proto --go_out=internal/api/pb --go_opt=paths=source_relative \
  --go_opt=Msanguo/world/v2/first_city.proto=github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1\;worldv1 \
  spec/proto/sanguo/world/v2/first_city.proto
mv internal/api/pb/sanguo/world/v2/first_city.pb.go internal/api/pb/sanguo/world/v1/first_city_v2.pb.go
```

`go test -count=1 ./internal/api -run 'FirstCityV2|FirstCityCanonical'`
