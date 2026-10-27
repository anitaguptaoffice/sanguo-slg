package march

import (
	"errors"
	"math"
	"reflect"
	"testing"
	"time"
)

func completionFixture(t *testing.T) (recruitScope, []recruitStockRow, []recruitPendingRow, *RecruitCatalog) {
	t.Helper()
	scope, stock, rows, c := pendingFixture(t)
	for id := int64(2); id <= 3; id++ {
		r := rows[0]
		r.id = id
		r.status = 0
		r.start = r.start.Add(-time.Hour)
		r.finish = r.finish.Add(-time.Hour)
		rows = append(rows, r)
	}
	return scope, stock, rows, c
}

func TestRecruitCompletionDueAndNoEffect(t *testing.T) {
	if (recruitCompletionPlan{}).disposition != recruitCompletionInvalid {
		t.Fatal("zero plan must remain invalid")
	}
	scope, stock, rows, c := completionFixture(t)
	due := rows[0].finish
	for _, tc := range []struct {
		name        string
		target      int64
		sample      time.Time
		disposition recruitCompletionDisposition
	}{
		{"early", 1, due.Add(-time.Millisecond), recruitCompletionEarly},
		{"clockBackward", 1, rows[0].start.Add(-time.Hour), recruitCompletionEarly},
		{"equal", 1, due, recruitCompletionDue},
		{"late", 1, due.Add(24 * time.Hour), recruitCompletionDue},
		{"waiting", 2, due.Add(24 * time.Hour), recruitCompletionWaiting},
		{"youngerWaiting", 3, due.Add(24 * time.Hour), recruitCompletionWaiting},
	} {
		t.Run(tc.name, func(t *testing.T) {
			beforeRows := append([]recruitPendingRow(nil), rows...)
			beforeStock := append([]recruitStockRow(nil), stock...)
			p, err := planRecruitCompletion(scope, stock, rows, c, tc.target, tc.sample)
			if err != nil || p.disposition != tc.disposition || p.targetID != tc.target {
				t.Fatal(p, err)
			}
			if p.disposition == recruitCompletionDue {
				if p.doneID != 1 || p.creditUnit != 1 || p.creditCount != 2 || p.readyAfter != 2 || p.promotionID != 2 || p.promotion.waiting || p.promotion.start != tc.sample || p.promotion.finish != tc.sample.Add(time.Minute) {
					t.Fatal("wrong single transition", p)
				}
			} else if p.doneID != 0 || p.creditCount != 0 || p.creditUnit != 0 || p.readyAfter != 0 || p.promotionID != 0 || p.promotion != (recruitSchedule{}) {
				t.Fatal("no-effect leaked writes", p)
			}
			if !reflect.DeepEqual(rows, beforeRows) || !reflect.DeepEqual(stock, beforeStock) {
				t.Fatal("mutated caller state")
			}
		})
	}
	// A submillisecond, non-UTC DB sample is canonicalized once before planning.
	sample := due.Add(999999 * time.Nanosecond).In(time.FixedZone("east", 8*3600))
	p, err := planRecruitCompletion(scope, stock, rows, c, 1, sample)
	if err != nil || p.promotion.start != due {
		t.Fatal("sample floor", p, err)
	}
	// This pure proposal is deterministic, NOT evidence that a prior call committed.
	again, err := planRecruitCompletion(scope, stock, rows, c, 1, sample)
	if err != nil || again != p {
		t.Fatal("nondeterministic plan")
	}
	rows[1].payload.Seconds = 999
	stock[0].ready = 999
	if p.creditCount != 2 || p.promotion.finish != due.Add(time.Minute) {
		t.Fatal("result alias")
	}
}

func TestRecruitCompletionStoredDurationAndCapacity(t *testing.T) {
	scope, stock, rows, c := completionFixture(t)
	// A new current price/time cannot change the accepted successor's duration.
	old := evidenceFixture(t)
	next := old
	next.Rules[0].SecondsPerUnit = 45
	var err error
	next.Version, err = RecruitManifestVersion(next.Rules)
	if err != nil {
		t.Fatal(err)
	}
	c, err = NewRecruitCatalog([]RecruitManifest{old, next}, next.Version)
	if err != nil {
		t.Fatal(err)
	}
	stock[0].ready = math.MaxInt32 - 6
	stock[0].wounded = math.MaxInt32
	p, err := planRecruitCompletion(scope, stock, rows, c, 1, rows[0].finish)
	if err != nil || p.readyAfter != math.MaxInt32-4 || p.promotion.finish != rows[0].finish.Add(60*time.Second) {
		t.Fatal("capacity or reprice", p, err)
	}
	if stock[0].wounded != math.MaxInt32 {
		t.Fatal("wounds changed")
	}
	rows = rows[:1]
	stock[0].ready = math.MaxInt32 - 2
	p, err = planRecruitCompletion(scope, stock, rows, c, 1, rows[0].finish)
	if err != nil || p.readyAfter != math.MaxInt32 || p.promotionID != 0 || p.promotion != (recruitSchedule{}) {
		t.Fatal("single completion", p, err)
	}
	stock[0].ready++
	if p, err = planRecruitCompletion(scope, stock, rows, c, 1, rows[0].finish); err == nil || p != (recruitCompletionPlan{}) {
		t.Fatal("overflow accepted")
	}
}

func TestRecruitCompletionFailClosed(t *testing.T) {
	for _, name := range []string{"missing", "zero", "negative", "ceiling", "empty", "badFinal", "badOldest", "wrongOwner", "year0", "year10000", "promotionOverflow"} {
		t.Run(name, func(t *testing.T) {
			scope, stock, rows, c := completionFixture(t)
			target := int64(1)
			sample := rows[0].finish
			switch name {
			case "missing":
				target = 99
			case "zero":
				target = 0
			case "negative":
				target = -1
			case "ceiling":
				target = 9007199254740992
			case "empty":
				rows = nil
			case "badFinal":
				rows[2].payload.Cost.Food++
			case "badOldest":
				rows[1].payload.Seconds++
			case "wrongOwner":
				scope.player++
			case "year0":
				sample = time.Date(0, 1, 1, 0, 0, 0, 0, time.UTC)
			case "year10000":
				sample = time.Date(10000, 1, 1, 0, 0, 0, 0, time.UTC)
			case "promotionOverflow":
				sample = time.Date(9999, 12, 31, 23, 59, 59, 999000000, time.UTC)
			}
			beforeRows := append([]recruitPendingRow(nil), rows...)
			beforeStock := append([]recruitStockRow(nil), stock...)
			p, err := planRecruitCompletion(scope, stock, rows, c, target, sample)
			if !errors.Is(err, errRecruitCompletionPlan) || p != (recruitCompletionPlan{}) {
				t.Fatal("nonzero failure", p, err)
			}
			if !reflect.DeepEqual(rows, beforeRows) || !reflect.DeepEqual(stock, beforeStock) {
				t.Fatal("partial mutation")
			}
		})
	}
	// Late completion at calendar maximum is valid without a successor addition.
	scope, stock, rows, c := completionFixture(t)
	rows = rows[:1]
	p, err := planRecruitCompletion(scope, stock, rows, c, 1, time.Date(9999, 12, 31, 23, 59, 59, 999000000, time.UTC))
	if err != nil || p.disposition != recruitCompletionDue {
		t.Fatal("maximum processing time", p, err)
	}
	// Corrupt state is not ignored merely because the active target is early.
	rows[0].payload.Count = 0
	if _, err = planRecruitCompletion(scope, stock, rows, c, 1, rows[0].start); err == nil {
		t.Fatal("early bypassed validation")
	}
}
