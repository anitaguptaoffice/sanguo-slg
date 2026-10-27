package march

import (
	"errors"
	"math"
	"reflect"
	"testing"
	"time"
)

func TestRecruitCanonicalTime(t *testing.T) {
	zone := time.FixedZone("east", 8*3600)
	for _, tc := range []struct {
		name        string
		input, want time.Time
	}{
		{"year1", time.Time{}, time.Time{}},
		{"year9999", time.Date(9999, 12, 31, 23, 59, 59, 999999999, time.UTC), time.Date(9999, 12, 31, 23, 59, 59, 999000000, time.UTC)},
		{"preEpochFloor", time.Unix(-1, 999999999), time.Unix(-1, 999000000).UTC()},
		{"offset", time.Date(2026, 10, 27, 8, 0, 0, 123456789, zone), time.Date(2026, 10, 27, 0, 0, 0, 123000000, time.UTC)},
		{"leapDay", time.Date(2000, 2, 29, 23, 59, 59, 123999999, time.UTC), time.Date(2000, 2, 29, 23, 59, 59, 123000000, time.UTC)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := canonicalRecruitTime(tc.input)
			if err != nil || got != tc.want || got.Location() != time.UTC {
				t.Fatalf("got %v, %v; want %v", got, err, tc.want)
			}
			again, err := canonicalRecruitTime(got)
			if err != nil || again != got {
				t.Fatal("not idempotent")
			}
		})
	}
	for _, input := range []time.Time{
		time.Date(0, 12, 31, 23, 59, 59, 999999999, time.UTC),
		time.Date(10000, 1, 1, 0, 0, 0, 0, time.UTC),
		time.Date(1, 1, 1, 0, 0, 0, 0, zone), // UTC date is outside range
	} {
		if got, err := canonicalRecruitTime(input); !errors.Is(err, errRecruitSchedule) || got != (time.Time{}) {
			t.Fatalf("accepted outside range: %v, %v", got, err)
		}
	}
}

func TestRecruitSchedulePlacement(t *testing.T) {
	now := time.Date(2026, 10, 27, 12, 0, 0, 123456789, time.UTC)
	base := now.Truncate(time.Millisecond)
	for _, tc := range []struct {
		name    string
		pending []time.Time
		want    time.Time
		waiting bool
	}{
		{"empty", nil, base, false},
		{"past", []time.Time{base.Add(-time.Hour)}, base, true},
		{"latestNotLast", []time.Time{base.Add(2 * time.Hour), base.Add(time.Hour)}, base.Add(2 * time.Hour), true},
		{"latestLast", []time.Time{base.Add(time.Hour), base.Add(2 * time.Hour)}, base.Add(2 * time.Hour), true},
		{"equal", []time.Time{base, base}, base, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			before := append([]time.Time(nil), tc.pending...)
			got, err := planRecruitSchedule(now, 30, tc.pending)
			if err != nil || got.start != tc.want || got.finish != tc.want.Add(30*time.Second) || got.waiting != tc.waiting {
				t.Fatalf("unexpected result %+v, %v", got, err)
			}
			if !reflect.DeepEqual(before, tc.pending) {
				t.Fatal("changed caller slice")
			}
		})
	}
	// After downtime/backward clock, promotion uses T, not old ETA or future tail.
	for _, sample := range []time.Time{now.Add(-time.Hour), now.Add(24 * time.Hour)} {
		got, err := planRecruitPromotion(sample, 45)
		want := sample.Truncate(time.Millisecond)
		if err != nil || got.waiting || got.start != want || got.finish != want.Add(45*time.Second) {
			t.Fatalf("promotion %+v, %v", got, err)
		}
	}
}

func TestRecruitScheduleBounds(t *testing.T) {
	max := time.Date(9999, 12, 31, 23, 59, 59, 999000000, time.UTC)
	start := max.Add(-time.Second)
	got, err := planRecruitSchedule(start, 1, nil)
	if err != nil || got.finish != max {
		t.Fatalf("exact max: %+v %v", got, err)
	}
	longest := int64(math.MaxInt64) / int64(time.Second)
	got, err = planRecruitSchedule(time.Time{}, longest, nil)
	if err != nil || got.finish != (time.Time{}).Add(time.Duration(longest)*time.Second) {
		t.Fatalf("largest duration: %+v %v", got, err)
	}
	zone := time.FixedZone("east", 3600)
	for _, tc := range []struct {
		name    string
		sample  time.Time
		seconds int64
		pending []time.Time
	}{
		{"zeroDuration", start, 0, nil}, {"negativeDuration", start, -1, nil},
		{"durationOverflow", time.Time{}, longest + 1, nil}, {"int64Overflow", start, math.MaxInt64, nil},
		{"timestampOverflow", max, 1, nil},
		{"year0", time.Date(0, 1, 1, 0, 0, 0, 0, time.UTC), 1, nil},
		{"year10000", time.Date(10000, 1, 1, 0, 0, 0, 0, time.UTC), 1, nil},
		{"pendingFraction", start, 1, []time.Time{start.Add(time.Nanosecond)}},
		{"pendingOffset", start, 1, []time.Time{start.In(zone)}},
		{"pendingOutside", start, 1, []time.Time{max.Add(time.Millisecond)}},
		{"pendingOverflow", start, 1, []time.Time{max}},
		{"badFinalEntry", start, 1, []time.Time{start, start.Add(time.Nanosecond)}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			before := append([]time.Time(nil), tc.pending...)
			value, err := planRecruitSchedule(tc.sample, tc.seconds, tc.pending)
			if !errors.Is(err, errRecruitSchedule) || value != (recruitSchedule{}) {
				t.Fatalf("want zero error result: %+v %v", value, err)
			}
			if !reflect.DeepEqual(before, tc.pending) {
				t.Fatal("changed error input")
			}
		})
	}
	// A stored timestamp is validated, never silently rounded during readback.
	if validRecruitTime(start.Add(time.Nanosecond)) {
		t.Fatal("rounded persisted timestamp")
	}
	if _, err := recruitFinish(start.Add(time.Nanosecond), 1); err == nil {
		t.Fatal("invalid finish input")
	}
	if _, err := planRecruitPromotion(max, 1); err == nil {
		t.Fatal("promotion overflow")
	}
}
