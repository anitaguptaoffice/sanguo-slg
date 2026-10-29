package march

import (
	"context"
	"errors"
	"testing"
)

func TestRecruitWriteInvalidHandles(t *testing.T) {
	ctx := context.Background()
	var nilAdmission *RecruitAdmission
	if _, err := nilAdmission.Write(ctx, nil); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("nil admission", err)
	}
	if _, err := (&RecruitAdmission{}).Write(ctx, nil); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("zero admission", err)
	}
	adm := &RecruitAdmission{state: &recruitAdmissionState{}}
	var noCtx context.Context
	if _, err := adm.Write(noCtx, nil); !errors.Is(err, ErrRecruitUnavailable) || !adm.state.used.Load() {
		t.Fatal("first invalid write was not consumed fail-closed", err)
	}
	copied := *adm
	if _, err := copied.Write(ctx, nil); !errors.Is(err, ErrRecruitUnavailable) {
		t.Fatal("copy after error", err)
	}
}
