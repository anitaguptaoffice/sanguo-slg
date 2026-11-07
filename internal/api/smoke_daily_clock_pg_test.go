package api_test

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	questv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/quest/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/db"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/runtime"
	"github.com/anitaguptaoffice/sanguo-slg/internal/quest"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/proto"
)

// Real gateway + PG evidence, not a direct quest-service or row-mutation test.
// There is no short-mode skip; the shared openDB only skips absent DATABASE_URL.
func TestSmokeDailyCalendarClockPG(t *testing.T) {
	for _, useDefault := range []bool{true, false} {
		name := "explicit_UTC_midnight"
		if useDefault {
			name = "default_calendar_restart"
		}
		t.Run(name, func(t *testing.T) {
			pool := openDB(t)
			ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
			defer cancel()
			if err := db.ApplySpecs(ctx, pool, runtime.RepoRoot()+"/spec/db"); err != nil {
				t.Fatal(err)
			}
			if err := db.SeedDevServer(ctx, pool, intg006ServerID, "S1"); err != nil {
				t.Fatal(err)
			}
			applyData002CoreSubsetSeeds(t, ctx, pool)
			if err := world.InitServerMap(ctx, world.NewPGStore(pool), intg006ServerID); err != nil {
				t.Fatal(err)
			}
			// An independent expectation detects default-helper injection loss.
			initial := time.Date(2030, time.January, 2, 23, 59, 59, 0, time.UTC)
			if !useDefault {
				// Local calendar is already May 1, but the reset boundary is UTC.
				initial = time.Date(2031, time.May, 1, 8, 59, 59, 500000000, time.FixedZone("UTC+9", 9*60*60))
			}
			var calendar atomic.Int64
			calendar.Store(initial.UnixNano())
			calendarNow := func() time.Time { return time.Unix(0, calendar.Load()).UTC() }
			log := slog.New(slog.NewTextHandler(io.Discard, nil))
			start := func(p *pgxpool.Pool) (*api.Server, *httptest.Server, string) {
				if useDefault {
					return startData002SmokeGateway(t, log, p, world.NewPGStore(p))
				}
				return startData002SmokeGatewayWithCalendar(t, log, p, world.NewPGStore(p), calendarNow)
			}
			srv, ts, wsURL := start(pool)
			defer ts.Close()
			c := dial(t, wsURL)
			defer func() { _ = c.Close() }()
			login := fmt.Sprintf("daily_clock_%d", time.Now().UnixNano())
			sid, playerID := smokeRegisterLogin(t, c, login)
			state, credit := smokeDailyFoodChain(t, ctx, c, srv, pool, sid, playerID)
			if state != 3 || credit != smokeDailyFoodGoldReward {
				t.Fatalf("initial claim: state=%d credit=%d", state, credit)
			}
			paid := smokeDailyClockRead(t, ctx, pool, playerID)
			smokeDailyClockAssertClaimed(t, paid, initial)
			if paid.receipts != 1 {
				t.Fatalf("daily receipt count=%d want=1", paid.receipts)
			}
			// Advance the existing integration clock across many UTC days. It
			// must not be the clock used by daily quest reads or progress hooks.
			srv.AdvanceSmokeTimeTo(initial.Add(72 * time.Hour))
			smokeDailyClockList(t, c, sid, questv1.PlayerQuestState_PLAYER_QUEST_STATE_COMPLETED)
			smokeDailyClockUnchanged(t, smokeDailyClockRead(t, ctx, pool, playerID), paid)

			_ = c.Close()
			ts.Close()
			pool.Close()
			pool2 := reopenDBPool(t)
			_, ts2, wsURL2 := start(pool2)
			defer ts2.Close()
			c2 := dial(t, wsURL2)
			defer func() { _ = c2.Close() }()
			sid2, gotPlayer := smokeLoginOnly(t, c2, login)
			if gotPlayer != playerID {
				t.Fatalf("restart actor=%d want=%d", gotPlayer, playerID)
			}
			smokeDailyClockList(t, c2, sid2, questv1.PlayerQuestState_PLAYER_QUEST_STATE_COMPLETED)
			smokeDailyClockAssertClaimed(t, smokeDailyClockRead(t, ctx, pool2, playerID), initial)
			smokeDailyClockUnchanged(t, smokeDailyClockRead(t, ctx, pool2, playerID), paid)
			smokeDailyClockRejectReplay(t, c2, sid2, quest.ErrAlreadyCompleted.Error())
			smokeDailyClockUnchanged(t, smokeDailyClockRead(t, ctx, pool2, playerID), paid)
			if useDefault {
				return
			}

			// Same server and gateway: only the independent quest calendar moves.
			midnight := initial.UTC().Add(500 * time.Millisecond)
			calendar.Store(midnight.UnixNano())
			for replay := 0; replay < 2; replay++ {
				smokeDailyClockList(t, c2, sid2, questv1.PlayerQuestState_PLAYER_QUEST_STATE_AVAILABLE)
				reset := smokeDailyClockRead(t, ctx, pool2, playerID)
				if reset.state != 0 || reset.progress != `{"count": 0}` || reset.accepted != nil || reset.completed != nil || reset.claimed != nil || !reset.updated.Equal(midnight) {
					t.Fatalf("UTC midnight reset: %+v", reset)
				}
				if reset.gold != paid.gold || reset.receipts != paid.receipts {
					t.Fatalf("reset duplicated reward: %+v want gold=%d receipts=%d", reset, paid.gold, paid.receipts)
				}
				smokeDailyClockRejectReplay(t, c2, sid2, quest.ErrNotClaimable.Error())
				smokeDailyClockUnchanged(t, smokeDailyClockRead(t, ctx, pool2, playerID), reset)
			}
		})
	}
}

type smokeDailyClockSnapshot struct {
	state                        int16
	progress                     string
	accepted, completed, claimed *time.Time
	updated                      time.Time
	gold, receipts               int64
}

func smokeDailyClockRead(t *testing.T, ctx context.Context, pool *pgxpool.Pool, playerID int64) smokeDailyClockSnapshot {
	t.Helper()
	var s smokeDailyClockSnapshot
	err := pool.QueryRow(ctx, `SELECT q.state,q.progress::text,q.accepted_at,q.completed_at,q.reward_claimed_at,q.updated_at,w.gold,
		(SELECT count(*) FROM reward_grant_queue WHERE server_id=$1 AND player_id=$2 AND idempotency_key=$4)
		FROM player_quest q JOIN player_wallet w USING(server_id,player_id)
		WHERE q.server_id=$1 AND q.player_id=$2 AND q.quest_cfg_id=$3`,
		intg006ServerID, playerID, smokeDailyFoodQuestCfgID, quest.QuestClaimIdempotencyKey(playerID, smokeDailyFoodQuestCfgID)).Scan(
		&s.state, &s.progress, &s.accepted, &s.completed, &s.claimed, &s.updated, &s.gold, &s.receipts)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func smokeDailyClockAssertClaimed(t *testing.T, got smokeDailyClockSnapshot, now time.Time) {
	t.Helper()
	if got.state != 3 || got.accepted == nil || got.completed == nil || got.claimed == nil ||
		!got.accepted.Equal(now) || !got.completed.Equal(now) || !got.claimed.Equal(now) || !got.updated.Equal(now) {
		t.Fatalf("calendar not injected/persisted: %+v want claimed at %s", got, now)
	}
}

func smokeDailyClockUnchanged(t *testing.T, got, want smokeDailyClockSnapshot) {
	t.Helper()
	equalTime := func(a, b *time.Time) bool { return a == nil && b == nil || a != nil && b != nil && a.Equal(*b) }
	if got.state != want.state || got.progress != want.progress || !equalTime(got.accepted, want.accepted) ||
		!equalTime(got.completed, want.completed) || !equalTime(got.claimed, want.claimed) ||
		!got.updated.Equal(want.updated) || got.gold != want.gold || got.receipts != want.receipts {
		t.Fatalf("daily state/reward changed: %+v want %+v", got, want)
	}
}

func smokeDailyClockList(t *testing.T, c *websocket.Conn, sid string, want questv1.PlayerQuestState) {
	t.Helper()
	resp := mustSend(t, c, &commonv1.ClientPacket{Route: api.RouteListPlayerQuests, TraceId: "daily-clock-hud",
		SessionId: sid, ServerId: intg006ServerID, Payload: mustMarshal(&questv1.ListPlayerQuestsRequest{
			ServerId: intg006ServerID, ChainId: smokeDailyQuestChainID, IncludeCompleted: true,
		})})
	var out questv1.ListPlayerQuestsResponse
	if resp.Code != 0 || proto.Unmarshal(resp.Data, &out) != nil {
		t.Fatalf("daily HUD: %+v", resp)
	}
	for _, q := range out.GetQuests() {
		if q.GetQuestCfgId() == smokeDailyFoodQuestCfgID {
			if q.GetState() != want {
				t.Fatalf("daily gateway state=%v want=%v", q.GetState(), want)
			}
			return
		}
	}
	t.Fatal("daily1012 absent from HUD")
}

func smokeDailyClockRejectReplay(t *testing.T, c *websocket.Conn, sid, wantMessage string) {
	t.Helper()
	resp := mustSend(t, c, &commonv1.ClientPacket{Route: api.RouteClaimQuestReward, TraceId: "daily-clock-replay",
		SessionId: sid, ServerId: intg006ServerID, Payload: mustMarshal(&questv1.ClaimQuestRewardRequest{
			ServerId: intg006ServerID, QuestCfgId: smokeDailyFoodQuestCfgID,
		})})
	if resp.Code != int32(commonv1.ErrorCode_COMMON_INVALID_PACKET) || resp.Msg != wantMessage {
		t.Fatalf("daily replay: %+v want invalid packet: %s", resp, wantMessage)
	}
}
