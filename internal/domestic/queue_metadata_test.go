package domestic

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPGQueueMetadataFailsClosedAtStartupAndAllocation(t *testing.T) {
	cases := map[string]string{
		"missing":          "DROP SEQUENCE work_queue_id_seq",
		"cycle":            "ALTER SEQUENCE work_queue_id_seq CYCLE",
		"wrong-ceiling":    "ALTER SEQUENCE work_queue_id_seq MAXVALUE 2",
		"wrong-increment":  "ALTER SEQUENCE work_queue_id_seq INCREMENT 2",
		"wrong-cache":      "ALTER SEQUENCE work_queue_id_seq CACHE 2",
		"wrong-start":      "ALTER SEQUENCE work_queue_id_seq START 2",
		"unlogged":         "ALTER SEQUENCE work_queue_id_seq SET UNLOGGED",
		"owned":            "ALTER SEQUENCE work_queue_id_seq OWNED BY work_queue.queue_id",
		"source-default":   "ALTER TABLE work_queue ALTER COLUMN payload SET DEFAULT '[]'::jsonb",
		"source-pk":        "ALTER TABLE work_queue DROP CONSTRAINT work_queue_pkey; ALTER TABLE work_queue ADD PRIMARY KEY(server_id,city_id,queue_id)",
		"source-rls":       "ALTER TABLE work_queue ENABLE ROW LEVEL SECURITY",
		"source-extra":     "ALTER TABLE work_queue ADD COLUMN unexpected bigint",
		"foreign-sequence": "CREATE SCHEMA foreign_seq; ALTER SEQUENCE work_queue_id_seq SET SCHEMA foreign_seq",
	}
	for name, sql := range cases {
		t.Run(name, func(t *testing.T) {
			pool, ctx := productionTestPool(t), context.Background()
			now := time.Unix(1700000000, 0)
			h, c := queueCity(t, pool, 1, 1, 42, &now)
			before := cloneCity(c)
			productionSQL(t, pool, sql)
			for _, candidate := range []*Hub{h, NewHub(func() time.Time { return now })} {
				if candidate != h {
					candidate.UseStore(NewPGStore(queuePeerPool(t, pool)), 1, 0)
					if _, err := candidate.LoadCity(ctx, c.ID, c.PlayerID); err != nil {
						t.Fatal("allocator broke reads", err)
					}
				}
				result, err := candidate.StartBuildingUpgrade(c.ID, "lumber", 3)
				if !errors.Is(err, ErrQueueIdentity) || result != (UpgradeResult{}) {
					t.Fatal("unsafe admission", result, err)
				}
			}
			queueUnchanged(t, pool, h, c, before, 0)
			if name == "missing" {
				if _, err := h.RefreshWallet(ctx, c.ID); err != nil {
					t.Fatal("missing sequence blocked wallet", err)
				}
				queueFixtureMaintenance(t, pool, 0)
				// The original successful binding cannot adopt a replacement OID.
				if _, err := h.StartBuildingUpgrade(c.ID, "lumber", 3); !errors.Is(err, ErrQueueIdentity) {
					t.Fatal("rebound replacement", err)
				}
			}
			if name == "foreign-sequence" {
				productionSQL(t, pool, "DROP SCHEMA foreign_seq CASCADE")
			}
		})
	}
}

func TestPGQueueBindingDoesNotAdoptPoolShardOrRecreatedSequence(t *testing.T) {
	for _, mode := range []string{"pool", "shard", "recreated"} {
		t.Run(mode, func(t *testing.T) {
			pool := productionTestPool(t)
			now := time.Unix(1700000000, 0)
			h, c := queueCity(t, pool, 1, 1, 42, &now)
			before := cloneCity(c)
			switch mode {
			case "pool":
				h.store.Pool = queuePeerPool(t, pool)
			case "shard":
				h.serverID = 2
			case "recreated":
				productionSQL(t, pool, "DROP SEQUENCE work_queue_id_seq")
				queueFixtureMaintenance(t, pool, 0)
			}
			if _, err := h.StartBuildingUpgrade(c.ID, "lumber", 3); !errors.Is(err, ErrQueueIdentity) {
				t.Fatal(err)
			}
			h.serverID = 1
			queueUnchanged(t, pool, h, c, before, 0)
		})
	}
}

func TestPGQueueTemporaryShadowsCannotAuthorizeBadSequence(t *testing.T) {
	for _, mode := range []string{"queue", "sequence", "pg_sequence", "pg_attrdef"} {
		t.Run(mode, func(t *testing.T) {
			pool := productionTestPool(t)
			now := time.Unix(1700000000, 0)
			_, c := queueCity(t, pool, 1, 1, 42, &now)
			if mode == "pg_sequence" {
				productionSQL(t, pool, "ALTER SEQUENCE work_queue_id_seq MAXVALUE 2 CYCLE")
			}
			if mode == "pg_attrdef" {
				productionSQL(t, pool, "ALTER TABLE work_queue ALTER COLUMN payload SET DEFAULT '[]'::jsonb")
			}
			cfg := pool.Config()
			cfg.MaxConns = 1
			cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
				sql := ""
				switch mode {
				case "queue":
					sql = "CREATE TEMP TABLE work_queue (LIKE work_queue INCLUDING ALL)"
				case "sequence":
					sql = "CREATE TEMP SEQUENCE work_queue_id_seq"
				case "pg_sequence":
					sql = "CREATE TEMP TABLE pg_sequence AS SELECT * FROM pg_catalog.pg_sequence; UPDATE pg_temp.pg_sequence SET seqmax=9007199254740991,seqcycle=false"
				case "pg_attrdef":
					sql = `CREATE TEMP TABLE benign_default(payload jsonb DEFAULT '{}'); CREATE TEMP TABLE pg_attrdef AS SELECT * FROM pg_catalog.pg_attrdef; UPDATE pg_temp.pg_attrdef SET adbin=(SELECT adbin FROM pg_catalog.pg_attrdef WHERE adrelid='benign_default'::regclass AND adnum=1) WHERE adrelid='work_queue'::regclass AND adnum=6`
				}
				_, err := conn.Exec(ctx, sql)
				return err
			}
			peer, err := pgxpool.NewWithConfig(context.Background(), cfg)
			if err != nil {
				t.Fatal(err)
			}
			defer peer.Close()
			h := NewHub(func() time.Time { return now })
			h.UseStore(NewPGStore(peer), 1, 0)
			// Install an isolated known cache so the temp queue does not change what Load reads.
			h.cities[c.ID] = cloneCity(c)
			if _, err = h.StartBuildingUpgrade(c.ID, "lumber", 3); !errors.Is(err, ErrQueueIdentity) {
				t.Fatal("shadow authorized allocator", err)
			}
			var last int64
			var called bool
			if err = pool.QueryRow(context.Background(), "SELECT last_value,is_called FROM work_queue_id_seq").Scan(&last, &called); err != nil || last != 1 || called {
				t.Fatal("shadow advanced real sequence", last, called, err)
			}
		})
	}
}

func TestPGQueueGrantedRuntimeRoleAndMissingUsage(t *testing.T) {
	pool, ctx := productionTestPool(t), context.Background()
	now := time.Unix(1700000000, 0)
	_, c := queueCity(t, pool, 1, 1, 42, &now)
	role := fmt.Sprintf("queue_runtime_%d", time.Now().UnixNano())
	productionSQL(t, pool, "CREATE ROLE "+role+" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE")
	schema := pool.Config().ConnConfig.RuntimeParams["search_path"]
	productionSQL(t, pool, fmt.Sprintf("GRANT USAGE ON SCHEMA %s TO %s; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA %s TO %s; GRANT SELECT,USAGE ON SEQUENCE work_queue_id_seq TO %s", schema, role, schema, role, role))
	cfg := pool.Config()
	cfg.ConnConfig.User = role
	peer, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { peer.Close(); productionSQL(t, pool, "DROP OWNED BY "+role+"; DROP ROLE "+role) }()
	h := NewHub(func() time.Time { return now })
	h.UseStore(NewPGStore(peer), 1, 0)
	if _, err = h.LoadCity(ctx, c.ID, c.PlayerID); err != nil {
		t.Fatal(err)
	}
	result, err := h.StartBuildingUpgrade(c.ID, "lumber", 3)
	if err != nil || result.JobID != 1 {
		t.Fatal("explicit grants rejected", result, err)
	}
	productionSQL(t, pool, "REVOKE USAGE ON SEQUENCE work_queue_id_seq FROM "+role)
	if _, err = h.StartBuildingUpgrade(c.ID, "stone", 4); !errors.Is(err, ErrQueueIdentity) {
		t.Fatal("missing USAGE accepted", err)
	}
	// Fresh startup must reject the same missing privilege, not probe nextval.
	denied := NewPGStore(peer)
	if _, err = denied.bindQueueIdentity(ctx, 1); !errors.Is(err, ErrQueueIdentity) {
		t.Fatal(err)
	}
	productionSQL(t, pool, "GRANT USAGE ON SEQUENCE work_queue_id_seq TO "+role)
	if _, err = denied.bindQueueIdentity(ctx, 1); !errors.Is(err, ErrQueueIdentity) {
		t.Fatal("fault rebound automatically", err)
	}
	// Grants do not authorize adoption of a sequence owned by another role.
	var owner string
	if err = pool.QueryRow(ctx, "SELECT current_user").Scan(&owner); err != nil {
		t.Fatal(err)
	}
	productionSQL(t, pool, "ALTER SEQUENCE work_queue_id_seq OWNER TO "+role)
	if _, err = h.StartBuildingUpgrade(c.ID, "stone", 4); !errors.Is(err, ErrQueueIdentity) {
		t.Fatal("foreign owner accepted", err)
	}
	productionSQL(t, pool, "ALTER SEQUENCE work_queue_id_seq OWNER TO "+pgx.Identifier{owner}.Sanitize())
}
