// Command fullchain runs an authenticated gateway + DB battle load test.
package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"os"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	accountroute "github.com/anitaguptaoffice/sanguo-slg/internal/account"
	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/battle"
	"github.com/anitaguptaoffice/sanguo-slg/internal/military/report"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	shardroute "github.com/anitaguptaoffice/sanguo-slg/internal/platform/shard"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/protobuf/proto"
)

type config struct {
	WSURL         string
	DatabaseURL   string
	Connections   int
	Battles       int
	BattleWorkers int
	ServerID      int32
	PlayerBase    int64
	Password      string
	LoginPrefix   string
}

func main() {
	cfg := config{
		WSURL:         env("LOAD_WS_URL", "ws://127.0.0.1:8080/ws"),
		DatabaseURL:   env("LOAD_DATABASE_URL", os.Getenv("DATABASE_URL")),
		Connections:   envInt("LOAD_CONCURRENCY", 3000),
		Battles:       envInt("LOAD_BATTLES", 5000),
		BattleWorkers: envInt("LOAD_BATTLE_WORKERS", 64),
		ServerID:      1,
		PlayerBase:    envInt64("LOAD_PLAYER_BASE", 1_000_000),
		Password:      env("LOAD_PASSWORD", "loadpass"),
		LoginPrefix:   env("LOAD_LOGIN_PREFIX", "load_"),
	}
	if cfg.DatabaseURL == "" {
		log.Fatal("LOAD_DATABASE_URL or DATABASE_URL is required")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	seedStart := time.Now()
	if err := seed(ctx, pool, cfg); err != nil {
		log.Fatalf("seed: %v", err)
	}
	fmt.Printf("seed: accounts=%d players=%d in %s\n", cfg.Connections, cfg.Connections, time.Since(seedStart).Round(time.Millisecond))

	connStart := time.Now()
	failures, closeAll := authenticate(ctx, cfg)
	authElapsed := time.Since(connStart)
	fmt.Printf("authenticated: %d/%d in %s failures=%d\n", cfg.Connections-failures, cfg.Connections, authElapsed.Round(time.Millisecond), failures)
	if failures > 0 {
		closeAll()
		log.Fatalf("login failures: %d", failures)
	}

	battleStart := time.Now()
	ok, failed := runBattles(ctx, pool, cfg)
	elapsed := time.Since(battleStart)
	closeAll()
	rate := float64(ok) / elapsed.Seconds()
	fmt.Printf("battle workload: %d/%d persisted in %s => %.1f battles/s failures=%d\n",
		ok, cfg.Battles, elapsed.Round(time.Millisecond), rate, failed)
	if failed > 0 || rate < 500 {
		log.Fatalf("battle target missed: %.1f battles/s", rate)
	}
	fmt.Println("PASS: authenticated gateway + DB-backed battle workload")
}

func seed(ctx context.Context, pool *pgxpool.Pool, cfg config) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(cfg.Password), bcrypt.MinCost)
	if err != nil {
		return err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	for i := 0; i < cfg.Connections; i++ {
		id := cfg.PlayerBase + int64(i)
		login := fmt.Sprintf("%s%d", cfg.LoginPrefix, id)
		if _, err := tx.Exec(ctx, `INSERT INTO account(account_id,login_name,password_hash,status)
			OVERRIDING SYSTEM VALUE VALUES($1,$2,$3,1) ON CONFLICT DO NOTHING`, id, login, string(hash)); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO player(server_id,player_id,account_id,display_name,level,power)
			VALUES($1,$2,$2,$3,1,$4) ON CONFLICT DO NOTHING`,
			cfg.ServerID, id, fmt.Sprintf("load-%d", i), 1000+i); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func authenticate(ctx context.Context, cfg config) (int, func()) {
	var failures atomic.Int64
	var wg sync.WaitGroup
	sem := make(chan struct{}, 200)
	conns := make(chan *websocket.Conn, cfg.Connections)
	for i := 0; i < cfg.Connections; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			id := cfg.PlayerBase + int64(i)
			conn, err := dialLogin(ctx, cfg, id)
			if err != nil {
				failures.Add(1)
				return
			}
			conns <- conn
		}(i)
	}
	wg.Wait()
	close(conns)
	// Drain buffered connections even when the caller closes later.
	held := make([]*websocket.Conn, 0, len(conns))
	for conn := range conns {
		held = append(held, conn)
	}
	return int(failures.Load()), func() {
		for _, conn := range held {
			_ = conn.Close()
		}
	}
}

func dialLogin(ctx context.Context, cfg config, playerID int64) (*websocket.Conn, error) {
	dialer := websocket.Dialer{HandshakeTimeout: 30 * time.Second}
	conn, _, err := dialer.DialContext(ctx, cfg.WSURL, nil)
	if err != nil {
		return nil, err
	}
	login := &accountv1.LoginRequest{LoginName: fmt.Sprintf("%s%d", cfg.LoginPrefix, playerID), Password: cfg.Password, ServerId: cfg.ServerID}
	data, err := proto.Marshal(login)
	if err != nil {
		_ = conn.Close()
		return nil, err
	}
	resp, err := roundTrip(conn, &commonv1.ClientPacket{Route: accountroute.RouteLogin, TraceId: fmt.Sprintf("load-login-%d", playerID), ServerId: cfg.ServerID, Payload: data})
	if err != nil {
		_ = conn.Close()
		return nil, err
	}
	var loginResp accountv1.LoginResponse
	if resp.GetCode() != 0 || proto.Unmarshal(resp.GetData(), &loginResp) != nil || loginResp.GetSessionId() == "" {
		_ = conn.Close()
		return nil, fmt.Errorf("login rejected code=%d msg=%s", resp.GetCode(), resp.GetMsg())
	}
	enter := &accountv1.EnterGameServerRequest{ServerId: cfg.ServerID}
	data, _ = proto.Marshal(enter)
	resp, err = roundTrip(conn, &commonv1.ClientPacket{Route: shardroute.RouteEnterGameServer,
		TraceId: fmt.Sprintf("load-enter-%d", playerID), SessionId: loginResp.GetSessionId(), ServerId: cfg.ServerID, Payload: data})
	if err != nil {
		_ = conn.Close()
		return nil, err
	}
	if resp.GetCode() != 0 {
		_ = conn.Close()
		return nil, fmt.Errorf("enter rejected code=%d msg=%s", resp.GetCode(), resp.GetMsg())
	}
	return conn, nil
}

func roundTrip(conn *websocket.Conn, pkt *commonv1.ClientPacket) (*commonv1.ServerPacket, error) {
	data, err := proto.Marshal(pkt)
	if err != nil {
		return nil, err
	}
	if err := conn.WriteMessage(websocket.BinaryMessage, data); err != nil {
		return nil, err
	}
	if err := conn.SetReadDeadline(time.Now().Add(30 * time.Second)); err != nil {
		return nil, err
	}
	_, raw, err := conn.ReadMessage()
	if err != nil {
		return nil, err
	}
	_ = conn.SetReadDeadline(time.Time{})
	var resp commonv1.ServerPacket
	if err := proto.Unmarshal(raw, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func runBattles(ctx context.Context, pool *pgxpool.Pool, cfg config) (int, int) {
	svc := report.NewService(report.NewPGStore(pool))
	var ok, failed atomic.Int64
	var wg sync.WaitGroup
	var issued atomic.Int64
	baseID := time.Now().UnixNano() % 1_000_000_000
	workers := cfg.BattleWorkers
	if workers < 1 {
		workers = 1
	}
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			rng := rand.New(rand.NewSource(int64(w) + time.Now().UnixNano()))
			for {
				n := issued.Add(1)
				if n > int64(cfg.Battles) {
					return
				}
				attacker := cfg.PlayerBase + rng.Int63n(int64(cfg.Connections))
				defender := cfg.PlayerBase + rng.Int63n(int64(cfg.Connections))
				var power int64
				if err := pool.QueryRow(ctx, `SELECT power FROM player WHERE server_id=$1 AND player_id=$2`,
					cfg.ServerID, attacker).Scan(&power); err != nil {
					failed.Add(1)
					continue
				}
				atk := battle.Army{Troops: map[battle.TroopType]int{
					battle.TroopInfantry: 400 + int(power%200),
					battle.TroopArcher:   150 + w%100,
					battle.TroopCavalry:  80 + w%50,
				}}
				def := battle.Army{Troops: map[battle.TroopType]int{
					battle.TroopInfantry: 380 + w%150,
					battle.TroopArcher:   160 + int(power%120),
					battle.TroopCavalry:  70 + w%60,
				}}
				rep := battle.Simulate(battle.BattleInput{
					BattleID:   fmt.Sprintf("load-%d", n),
					AttackerID: fmt.Sprintf("player-%d", attacker),
					DefenderID: fmt.Sprintf("player-%d", defender),
					Attacker:   atk,
					Defender:   def,
				})
				if _, err := svc.Save(ctx, report.SaveParams{
					ServerID: cfg.ServerID, ReportID: baseID + n,
					AttackerPlayerID: attacker, DefenderPlayerID: defender,
					LocationX: int(n % 500), LocationY: int((n / 500) % 500), Report: rep,
				}); err != nil {
					failed.Add(1)
					continue
				}
				ok.Add(1)
			}
		}(w)
	}
	wg.Wait()
	return int(ok.Load()), int(failed.Load())
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		n, err := strconv.Atoi(v)
		if err == nil {
			return n
		}
	}
	return fallback
}

func envInt64(key string, fallback int64) int64 {
	if v := os.Getenv(key); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			return n
		}
	}
	return fallback
}
