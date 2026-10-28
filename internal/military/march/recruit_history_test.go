package march

import (
	"bytes"
	"testing"
	"time"
)

func TestRecruitHistoryEvolution(t *testing.T) {
	at := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	city := int64(100)
	active := recruitHistoryQueue{cityID: &city, startAt: at, finishAt: at.Add(time.Minute), status: 1}
	live := recruitHistoryReceipt{acceptedAt: at, startAt: at, finishAt: at.Add(time.Minute), initialStatus: 1, durationSec: 60}
	done := active
	done.status = 2
	if !recruitHistoryEvolution(active, live) || !recruitHistoryEvolution(done, live) {
		t.Fatal("active/done rejected")
	}
	wait := recruitHistoryReceipt{acceptedAt: at, startAt: at.Add(time.Minute), finishAt: at.Add(2 * time.Minute), initialStatus: 0, durationSec: 60}
	q0 := recruitHistoryQueue{cityID: &city, startAt: wait.startAt, finishAt: wait.finishAt}
	q1 := recruitHistoryQueue{cityID: &city, startAt: at.Add(2 * time.Minute), finishAt: at.Add(3 * time.Minute), status: 1}
	if !recruitHistoryEvolution(q0, wait) || !recruitHistoryEvolution(q1, wait) {
		t.Fatal("waiting/promoted rejected")
	}
	q1.finishAt = q1.finishAt.Add(time.Second)
	if recruitHistoryEvolution(q1, wait) {
		t.Fatal("promoted duration mismatch accepted")
	}
}

func TestRecruitHistoryAcceptanceCopies(t *testing.T) {
	at := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	r := recruitHistoryReceipt{catalogVersion: []byte("v1"), ruleDigest: bytes.Repeat([]byte{0xaa}, 32), acceptedAt: at, durationSec: 60}
	got := recruitHistoryAcceptance(recruitHistoryQueue{queueID: 7}, r)
	r.catalogVersion[0], r.ruleDigest[0] = 'x', 0
	if got.QueueID != 7 || got.CatalogVersion != "v1" || got.RuleDigest[0] != 0xaa {
		t.Fatal("acceptance fields or copy failed")
	}
}
