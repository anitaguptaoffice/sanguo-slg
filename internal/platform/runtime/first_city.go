package runtime

import (
	"context"
	"crypto/sha1"
	"errors"
	"fmt"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
	"github.com/jackc/pgx/v5/pgxpool"
)

// firstCityCatalogVersion identifies the spec data subset the starter city content
// was reviewed against. It is embedded in the immutable template reference.
const firstCityCatalogVersion = "DATA-002"

// firstCityTemplateIntake serves the single reviewed starter template. The template
// is player-independent, so every actor resolves to the same immutable reference.
type firstCityTemplateIntake struct {
	ref *worldv1.FirstCityTemplateRef
}

func (t firstCityTemplateIntake) SelectTemplate(context.Context, *worldv1.FirstCityScope) (*worldv1.FirstCityTemplateRef, error) {
	if t.ref == nil || len(t.ref.GetContentSha256()) == 0 {
		return nil, errors.New("first-city template unavailable")
	}
	return t.ref, nil
}

// composeFirstCity enables the world.v2 first-city routes and installs the ledger,
// template intake and creation effect. When PostgreSQL is available, intents and
// terminal receipts persist across process restarts; without a pool, falls back to mem.
func composeFirstCity(ctx context.Context, srv *api.Server, pool *pgxpool.Pool, hub *domestic.Hub) {
	srv.EnableFirstCityV2Routes(func(pc api.PlayerContext) (string, bool) {
		return firstCityRealmID(pc.ServerID), true
	})
	intake := firstCityTemplateIntake{ref: api.FirstCityTemplateRef(firstCityCatalogVersion)}
	var ledger api.FirstCityV2Ledger
	if srv != nil && srv.PlayersPool() != nil {
		ledger = api.NewPGFirstCityLedger(srv.PlayersPool())
	}
	if ledger == nil {
		ledger = api.NewMemFirstCityLedger()
	}
	srv.WireFirstCityV2Ledger(ledger, intake)
	if src := maybeFirstCityPreparedSource(ctx, srv, pool, hub); src != nil {
		srv.WireFirstCityPreparedCreation(src)
	}
	srv.WireFirstCityV2Effect(srv.FirstCityCreationEffect())
}

// firstCityRealmID derives the stable realm identity for one shard. The canonical
// intent validator requires a UUID, so the shard identity is expanded through an
// RFC 4122 version-4-shaped name-derived UUID; the same shard always yields the same realm.
func firstCityRealmID(serverID int32) string {
	sum := sha1.Sum([]byte(fmt.Sprintf("sanguo.first-city.realm/shard/%d", serverID)))
	sum[6] = (sum[6] & 0x0f) | 0x40
	sum[8] = (sum[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", sum[0:4], sum[4:6], sum[6:8], sum[8:10], sum[10:16])
}
