package march

import (
	"errors"
	"math"
	"reflect"
	"testing"
	"time"
)

func pendingFixture(t *testing.T) (recruitScope, []recruitStockRow, []recruitPendingRow, *RecruitCatalog) {
	t.Helper()
	scope := recruitScope{1, 42, 9}
	c := payloadCatalog(t)
	stock := []recruitStockRow{{1, 9, 1, 0, 0}, {1, 9, 2, 0, 0}, {1, 9, 3, 0, 0}, {1, 9, 4, 0, 0}}
	p, err := decodeRecruitPayload([]byte(payloadGolden), c)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 27, 0, 0, 0, 123000000, time.UTC)
	rows := []recruitPendingRow{{scope: scope, id: 1, kind: 3, status: 1, payload: p, start: now, finish: now.Add(time.Minute)}}
	return scope, stock, rows, c
}

func TestRecruitPendingValid(t *testing.T) {
	scope, stock, rows, c := pendingFixture(t)
	stock[0].ready = math.MaxInt32 - 2
	stock[0].wounded = math.MaxInt32
	empty, err := validateRecruitPending(scope, stock, nil, c)
	if err != nil || empty.activeID != 0 || empty.oldestWaitingID != 0 || empty.canAddCount(1, 2) != nil || empty.canAddCount(1, 3) == nil {
		t.Fatal("empty capacity", err)
	}
	single, err := validateRecruitPending(scope, stock, rows, c)
	if err != nil || single.activeID != 1 || single.oldestWaitingID != 0 || single.reserved[0] != math.MaxInt32 || single.canAddCount(1, 1) == nil {
		t.Fatal("single capacity", err)
	}
	if single.canAddCount(2, math.MaxInt32) != nil {
		t.Fatal("unrelated unit blocked")
	}
	// Waiting finishes may precede a promoted active finish after downtime.
	stock[0].ready = 0
	waiting := rows[0]
	waiting.id = 2
	waiting.status = 0
	waiting.start = waiting.start.Add(-time.Hour)
	waiting.finish = waiting.finish.Add(-time.Hour)
	rows = append(rows, waiting)
	beforeStock := append([]recruitStockRow(nil), stock...)
	beforeRows := append([]recruitPendingRow(nil), rows...)
	many, err := validateRecruitPending(scope, stock, rows, c)
	if err != nil || many.reserved[0] != 4 || many.oldestWaitingID != 2 {
		t.Fatal("waiting estimate order", err)
	}
	if !reflect.DeepEqual(stock, beforeStock) || !reflect.DeepEqual(rows, beforeRows) {
		t.Fatal("mutated input")
	}
	stock[0].ready = 99
	rows[0].payload.Count = 99
	if many.reserved[0] != 4 {
		t.Fatal("result retains input alias")
	}
	for _, pair := range [][2]int32{{0, 1}, {5, 1}, {1, 0}, {1, -1}} {
		if many.canAddCount(pair[0], pair[1]) == nil {
			t.Fatal("invalid proposed count")
		}
	}
	if (recruitPendingSummary{}).canAddCount(1, 1) == nil {
		t.Fatal("zero summary valid")
	}
}

func TestRecruitPendingRejectStock(t *testing.T) {
	for name, change := range map[string]func([]recruitStockRow) []recruitStockRow{
		"missing":       func(s []recruitStockRow) []recruitStockRow { return s[:3] },
		"extra":         func(s []recruitStockRow) []recruitStockRow { return append(s, s[0]) },
		"duplicate":     func(s []recruitStockRow) []recruitStockRow { s[3].unit = 1; return s },
		"unitZero":      func(s []recruitStockRow) []recruitStockRow { s[3].unit = 0; return s },
		"unitExtra":     func(s []recruitStockRow) []recruitStockRow { s[3].unit = 5; return s },
		"wrongServer":   func(s []recruitStockRow) []recruitStockRow { s[3].server++; return s },
		"wrongCity":     func(s []recruitStockRow) []recruitStockRow { s[3].city++; return s },
		"negativeReady": func(s []recruitStockRow) []recruitStockRow { s[3].ready = -1; return s },
		"readyOverflow": func(s []recruitStockRow) []recruitStockRow { s[3].ready = math.MaxInt32 + 1; return s },
		"negativeWound": func(s []recruitStockRow) []recruitStockRow { s[3].wounded = -1; return s },
		"woundOverflow": func(s []recruitStockRow) []recruitStockRow { s[3].wounded = math.MaxInt32 + 1; return s },
	} {
		t.Run(name, func(t *testing.T) {
			scope, stock, rows, c := pendingFixture(t)
			stock = change(stock)
			before := append([]recruitStockRow(nil), stock...)
			got, err := validateRecruitPending(scope, stock, rows, c)
			if !errors.Is(err, errRecruitPending) || got != (recruitPendingSummary{}) {
				t.Fatal("accepted stock", got, err)
			}
			if !reflect.DeepEqual(stock, before) {
				t.Fatal("mutated invalid stock")
			}
		})
	}
	scope, stock, rows, c := pendingFixture(t)
	for _, bad := range []recruitScope{{}, {0, 42, 9}, {1, 0, 9}, {1, 42, 0}} {
		if _, err := validateRecruitPending(bad, stock, rows, c); err == nil {
			t.Fatal("invalid scope")
		}
	}
	for _, bad := range []*RecruitCatalog{nil, {}} {
		if _, err := validateRecruitPending(scope, stock, rows, bad); err == nil {
			t.Fatal("invalid catalog")
		}
	}
}

func TestRecruitPendingRejectRows(t *testing.T) {
	for name, change := range map[string]func(*recruitPendingRow){
		"idZero": func(r *recruitPendingRow) { r.id = 0 }, "idNegative": func(r *recruitPendingRow) { r.id = -1 },
		"idCeiling": func(r *recruitPendingRow) { r.id = 9007199254740992 },
		"server":    func(r *recruitPendingRow) { r.scope.server++ }, "city": func(r *recruitPendingRow) { r.scope.city++ }, "owner": func(r *recruitPendingRow) { r.scope.player++ },
		"type": func(r *recruitPendingRow) { r.kind = 1 }, "waitingOnly": func(r *recruitPendingRow) { r.status = 0 },
		"done": func(r *recruitPendingRow) { r.status = 2 }, "canceled": func(r *recruitPendingRow) { r.status = 3 }, "unknown": func(r *recruitPendingRow) { r.status = -1 },
		"payload": func(r *recruitPendingRow) { r.payload.Cost.Food++ }, "count": func(r *recruitPendingRow) { r.payload.Count = 0 },
		"startFraction":  func(r *recruitPendingRow) { r.start = r.start.Add(time.Nanosecond) },
		"finishFraction": func(r *recruitPendingRow) { r.finish = r.finish.Add(time.Nanosecond) },
		"wrongDuration":  func(r *recruitPendingRow) { r.finish = r.finish.Add(time.Second) },
		"backwards":      func(r *recruitPendingRow) { r.finish = r.start.Add(-time.Second) },
		"timeOverflow":   func(r *recruitPendingRow) { r.start = time.Date(9999, 12, 31, 23, 59, 59, 0, time.UTC) },
	} {
		t.Run(name, func(t *testing.T) {
			scope, stock, rows, c := pendingFixture(t)
			change(&rows[0])
			before := append([]recruitPendingRow(nil), rows...)
			got, err := validateRecruitPending(scope, stock, rows, c)
			if !errors.Is(err, errRecruitPending) || got != (recruitPendingSummary{}) {
				t.Fatal("accepted row", got, err)
			}
			if !reflect.DeepEqual(rows, before) {
				t.Fatal("mutated rejected rows")
			}
		})
	}
	for _, kind := range []string{"duplicateID", "twoActive", "olderWaiting", "badFinal"} {
		scope, stock, rows, c := pendingFixture(t)
		second := rows[0]
		second.id = 2
		second.status = 0
		rows = append(rows, second)
		switch kind {
		case "duplicateID":
			rows[1].id = 1
		case "twoActive":
			rows[1].status = 1
		case "olderWaiting":
			rows[0], rows[1] = rows[1], rows[0]
		case "badFinal":
			rows[1].payload.Cost.Food++
		}
		if got, err := validateRecruitPending(scope, stock, rows, c); err == nil || got != (recruitPendingSummary{}) {
			t.Fatal(kind)
		}
	}
}

func TestRecruitPendingAggregate(t *testing.T) {
	scope, stock, rows, c := pendingFixture(t)
	e, err := c.Current(2)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := encodeRecruitPayload(e, RecruitRequest{UnitCfgID: 2, Count: 3})
	if err != nil {
		t.Fatal(err)
	}
	p, err := decodeRecruitPayload(raw, c)
	if err != nil {
		t.Fatal(err)
	}
	second := rows[0]
	second.id = 2
	second.status = 0
	second.payload = p
	second.finish = second.start.Add(135 * time.Second)
	rows = append(rows, second)
	stock[1].ready = math.MaxInt32 - 3
	good, err := validateRecruitPending(scope, stock, rows, c)
	if err != nil || good.reserved[1] != math.MaxInt32 || good.canAddCount(1, 1) != nil {
		t.Fatal("multiunit", err)
	}
	stock[1].ready++
	if got, err := validateRecruitPending(scope, stock, rows, c); err == nil || got != (recruitPendingSummary{}) {
		t.Fatal("unrelated unit existing overflow ignored")
	}
	stock[1].ready = 0
	rows = rows[:1]
	for id := int64(2); id <= 1000; id++ {
		r := rows[0]
		r.id = id
		r.status = 0
		rows = append(rows, r)
	}
	many, err := validateRecruitPending(scope, stock, rows, c)
	if err != nil || many.reserved[0] != 2000 {
		t.Fatal("invented waiting cap", err)
	}
	rows[len(rows)-1].payload.Count = 0
	if got, err := validateRecruitPending(scope, stock, rows, c); err == nil || got != (recruitPendingSummary{}) {
		t.Fatal("ignored last supplied row")
	}
	// Both IDs at the safe positive boundary and arbitrary stock order are legal.
	rows = rows[:1]
	rows[0].id = 9007199254740991
	stock[0], stock[3] = stock[3], stock[0]
	if _, err := validateRecruitPending(scope, stock, rows, c); err != nil {
		t.Fatal("valid bounds", err)
	}
}
