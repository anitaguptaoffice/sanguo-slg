package runtime

import (
	"context"
	"crypto/sha1"
	"errors"
	"fmt"

	"github.com/anitaguptaoffice/sanguo-slg/internal/api"
	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
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
// template intake and creation effect. The ledger is process-local: intents and
// receipts survive login reconnects but not a server restart. A SQL-backed ledger
// and the full recovery matrix remain separate cards.
func composeFirstCity(srv *api.Server) {
	srv.EnableFirstCityV2Routes(func(pc api.PlayerContext) (string, bool) {
		return firstCityRealmID(pc.ServerID), true
	})
	srv.WireFirstCityV2Ledger(
		api.NewMemFirstCityLedger(),
		firstCityTemplateIntake{ref: api.FirstCityTemplateRef(firstCityCatalogVersion)},
	)
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
