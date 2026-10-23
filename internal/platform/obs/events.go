package obs

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"strings"
)

// Stable gameplay telemetry event names (TELEMETRY-001).
const (
	EventLogin              = "login"
	EventCreateCity         = "create_city"
	EventBattleReportReady  = "battle_report_ready"
	EventShopPurchase       = "shop_purchase"
	EventQuestClaimReward   = "quest_claim_reward"
)

// PlayerRef identifies a shard player without PII.
type PlayerRef struct {
	ServerID int32
	PlayerID int64
}

// EmitGameplayEvent logs one structured JSON record and increments sanguo_gameplay_events_total.
func EmitGameplayEvent(log *slog.Logger, traceID string, event string, player PlayerRef, attrs ...slog.Attr) {
	if log == nil {
		log = slog.Default()
	}
	ctx := contextWithTrace(traceID)
	args := []any{
		slog.String("event", event),
		slog.String("trace_id", traceID),
		slog.Int("server_id", int(player.ServerID)),
		slog.Int64("player_id", player.PlayerID),
	}
	for _, a := range attrs {
		args = append(args, a)
	}
	log.InfoContext(ctx, "gameplay event", args...)
	DefaultMetrics().recordGameplay(event)
}

func contextWithTrace(traceID string) context.Context {
	if traceID == "" {
		return context.Background()
	}
	return context.WithValue(context.Background(), traceKey{}, traceID)
}

func (m *Metrics) recordGameplay(event string) {
	if event == "" {
		return
	}
	m.mu.Lock()
	m.gameplay[event]++
	m.mu.Unlock()
}

func writeGameplayMetrics(b *strings.Builder, gameplay map[string]uint64) {
	if len(gameplay) == 0 {
		return
	}
	b.WriteString("# HELP sanguo_gameplay_events_total Gameplay telemetry events\n")
	b.WriteString("# TYPE sanguo_gameplay_events_total counter\n")
	keys := make([]string, 0, len(gameplay))
	for k := range gameplay {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, ev := range keys {
		fmt.Fprintf(b, "sanguo_gameplay_events_total{event=\"%s\"} %d\n", ev, gameplay[ev])
	}
}
