// Package obs provides trace-aware slog helpers, HTTP middleware, and Prometheus text metrics.
//
// Runtime integration (outside this package): wrap the root handler with obs.Wrap and
// register mux.Handle("/metrics", obs.MetricsHandler()).
//
// Gameplay telemetry (TELEMETRY-001): call EmitGameplayEvent on successful API paths.
// Stable event names: login, create_city, battle_report_ready, shop_purchase, quest_claim_reward.
// Each record includes event, trace_id, server_id, player_id (no PII). Counter: sanguo_gameplay_events_total{event="..."}.
//
// Query locally: JSON logs on stdout, e.g. grep '"msg":"gameplay event"' | grep '"event":"login"'.
// In Grafana/Prometheus: rate(sanguo_gameplay_events_total[5m]) by (event), or sum by (event) (sanguo_gameplay_events_total).
package obs
