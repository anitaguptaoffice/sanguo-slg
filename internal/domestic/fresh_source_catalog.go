package domestic

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

var errFreshSourceMetadata = errors.New("domestic: fresh source metadata mismatch")

// snapshotFreshSourceProfile accepts identity data, never caller-defined shapes.
func snapshotFreshSourceProfile(p freshsource.Profile) (freshsource.Profile, error) {
	p, err := freshsource.Snapshot(p)
	if err != nil || len(p.Objects) != 8 || strings.HasPrefix(p.SchemaName, "pg_") || p.SchemaName == "information_schema" {
		return freshsource.Profile{}, freshsource.ErrProfile
	}
	for _, name := range []string{p.DatabaseName, p.SchemaName, p.CurrentRoleName, p.SessionRoleName} {
		if !utf8.ValidString(name) || strings.ContainsRune(name, 0) {
			return freshsource.Profile{}, freshsource.ErrProfile
		}
	}
	for _, name := range []string{"player_wallet", "player_wallet_pkey", "city_production_checkpoint",
		"city_production_checkpoint_pkey", "idx_city_production_player", "city_building", "city_building_pkey", "idx_city_building_cfg"} {
		if _, ok := p.Objects[name]; !ok {
			return freshsource.Profile{}, freshsource.ErrProfile
		}
	}
	return p, nil
}

// validateFreshSource is stateless and read-only. READ COMMITTED scans are not a
// repeatable snapshot; external DDL/role/writer exclusion remains mandatory.
// Neither success nor this private copied data enrolls a source or mints a proof.
func validateFreshSource(ctx context.Context, b *recruittx.Binding, a *recruittx.Access, p freshsource.Profile) error {
	var privateAccess recruittx.Access
	if a != nil {
		privateAccess = *a
	}
	p, err := snapshotFreshSourceProfile(p)
	if err != nil {
		return err
	}
	if err = privateAccess.CheckSameTransaction(ctx, b, &privateAccess); err != nil {
		return err
	}
	walletProfile := p
	walletProfile.Objects = map[string]freshsource.ObjectIdentity{
		"player_wallet": p.Objects["player_wallet"], "player_wallet_pkey": p.Objects["player_wallet_pkey"],
	}
	wallet := RecruitWallet{binding: b, profile: walletProfile}
	if err = wallet.validate(ctx, &privateAccess); err != nil {
		if errors.Is(err, ErrRecruitWalletSource) {
			return errFreshSourceMetadata
		}
		return err
	}
	objects, err := json.Marshal(p.Objects)
	if err != nil {
		return err
	}
	var valid bool
	err = privateAccess.Scan(ctx, b, freshCityCatalog,
		[]any{objects, p.SchemaOID, freshCityColumns, freshCityConstraints, freshCityIndexes}, &valid)
	if err != nil {
		return err
	}
	if !valid {
		return errFreshSourceMetadata
	}
	return nil
}
