package march

import (
	"context"
	"errors"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestRecruitCompletionReadInvalidHandles(t *testing.T) {
	check := func(name string, err error) {
		t.Helper()
		if !errors.Is(err, ErrRecruitUnavailable) {
			t.Fatal(name, err)
		}
	}
	c := RecruitCandidate{1, 1, 100, 40}
	var nilParticipant *RecruitParticipant
	_, err := nilParticipant.CompletionHint(context.Background(), nil, c)
	check("nil hint", err)
	check("nil done", nilParticipant.DoneHistory(context.Background(), nil, c))
	p := &RecruitParticipant{source: &freshMilitarySource{binding: &recruittx.Binding{}, profile: freshsource.Profile{ServerID: 1}}, catalog: &RecruitCatalog{}}
	for _, bad := range []RecruitCandidate{{0, 1, 100, 40}, {2, 1, 100, 40}, {1, 0, 100, 40}, {1, 1, 0, 40}, {1, 1, 100, 0}, {1, 1, 100, 9007199254740992}} {
		_, err := p.CompletionHint(context.Background(), &recruittx.Access{}, bad)
		check("shape", err)
	}
	_, err = p.CompletionHint(context.Background(), nil, c)
	check("nil access", err)
	p.source.retired.Store(true)
	copied := *p
	for _, handle := range []*RecruitParticipant{p, &copied} {
		_, err := handle.CompletionHint(context.Background(), &recruittx.Access{}, c)
		check("retired hint", err)
		check("retired done", handle.DoneHistory(context.Background(), &recruittx.Access{}, c))
	}
	if !recruitCandidateCommand([]byte{1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}) || recruitCandidateCommand(make([]byte, 16)) || recruitCandidateCommand(make([]byte, 15)) {
		t.Fatal("command")
	}
}

func TestRecruitCompletionReadEvidenceCommand(t *testing.T) {
	h, catalog, _, _ := historyDefaults(t)
	x := recruitCandidateRow{q: recruitHistoryQueue{serverID: 1, queueID: h.queueID, playerID: h.player, cityID: &h.qCity, queueType: 3, status: h.status, payload: h.payload, startAt: h.qstart, finishAt: h.qfinish}, playerID: h.player, operation: 1, command: h.command[:], r: recruitHistoryReceipt{serverID: 1, queueID: h.queueID, intentVersion: 1, cityID: h.qCity, unitCfgID: 1, count: h.count, food: h.cost.Food, wood: h.cost.Wood, iron: h.cost.Iron, stone: h.cost.Stone, durationSec: h.duration, catalogVersion: h.version, ruleDigest: h.digest[:], acceptedAt: h.accepted, startAt: h.rstart, finishAt: h.rfinish, initialStatus: h.initial}}
	c, p := RecruitCandidate{1, h.player, h.qCity, h.queueID}, &RecruitParticipant{catalog: catalog}
	for _, command := range [][]byte{h.command[:], make([]byte, 16), make([]byte, 15)} {
		x.command = command
		if got := recruitCandidateEvidence(p, x, c); got != (len(command) == 16 && command[0] != 0) {
			t.Fatal("command", len(command))
		}
	}
}
