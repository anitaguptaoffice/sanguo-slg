package march

import (
	"context"
	"errors"
	"testing"
)

func TestRecruitPrepareValidation(t *testing.T) {
	for _, c := range []struct {
		intent RecruitIntent
		want   error
	}{
		{RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 1, Count: 2}, nil},
		{RecruitIntent{Version: 0, CityID: 100, UnitCfgID: 1, Count: 2}, ErrRecruitUnsupportedVersion},
		{RecruitIntent{Version: 2, CityID: 100, UnitCfgID: 1, Count: 2}, ErrRecruitUnsupportedVersion},
		{RecruitIntent{Version: 65537, CityID: 100, UnitCfgID: 1, Count: 2}, ErrRecruitUnsupportedVersion},
		{RecruitIntent{Version: 4294967295, CityID: 100, UnitCfgID: 1, Count: 2}, ErrRecruitUnsupportedVersion},
		{RecruitIntent{Version: 1, CityID: 0, UnitCfgID: 1, Count: 2}, ErrRecruitUnavailable},
		{RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 0, Count: 2}, ErrRecruitUnavailable},
		{RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 5, Count: 2}, ErrRecruitUnavailable},
		{RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 1, Count: 0}, ErrRecruitUnavailable},
		{RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 1, Count: -1}, ErrRecruitUnavailable},
	} {
		if err := validRecruitIntent(c.intent); !errors.Is(err, c.want) {
			t.Fatal(c.intent, err)
		}
	}
}

func TestRecruitPrepareInvalidHandle(t *testing.T) {
	intent := RecruitIntent{Version: 1, CityID: 100, UnitCfgID: 1, Count: 1}
	var nilParticipant *RecruitParticipant
	if _, err := nilParticipant.Prepare(context.Background(), nil, RecruitScope{}, intent); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal(err)
	}
	if _, err := (*RecruitAdmission)(nil).Cost(context.Background(), nil); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal(err)
	}
}
