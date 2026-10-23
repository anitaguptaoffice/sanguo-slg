# 可观测性栈（PLAT-003）

```bash
# 游戏服需挂载 obs.Wrap 并暴露 /metrics（见 internal/platform/obs/doc.go）
docker compose -f deploy/docker-compose.obs.yml up -d
```

- Prometheus: http://localhost:9090（抓取 `host.docker.internal:8080/metrics`）
- Grafana: http://localhost:3000（`admin` / `admin`，面板 **Sanguo Overview**）

验证：`curl -s localhost:8080/metrics | grep sanguo_`
