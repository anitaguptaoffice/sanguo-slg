package domestic

import (
	"crypto/sha256"
	"errors"
	"math"
	"regexp"
	"strings"
	"unicode/utf8"
)

// Independent audit parser: explicit byte arithmetic, no production reader,
// encoder, snapshot validator or default catalog. It has no execution authority.
type freshCodecOracle struct {
	data   []byte
	offset int
	err    error
}

func (r *freshCodecOracle) take(n int) []byte {
	if r.err != nil || n < 0 || n > len(r.data)-r.offset {
		r.err = errors.New("oracle: truncated content")
		return nil
	}
	out := r.data[r.offset : r.offset+n]
	r.offset += n
	return out
}

func (r *freshCodecOracle) number(width int, maximum uint64) uint64 {
	var number uint64
	for _, octet := range r.take(width) {
		number = number<<8 | uint64(octet)
	}
	if number > maximum {
		r.err = errors.New("oracle: integer outside range")
		return 0
	}
	return number
}

func (r *freshCodecOracle) text(maximum uint64) string {
	n := r.number(1, maximum)
	if n == 0 {
		r.err = errors.New("oracle: empty string")
	}
	return string(r.take(int(n)))
}

func (r *freshCodecOracle) resources() Resources {
	return Resources{
		int64(r.number(8, math.MaxInt64)), int64(r.number(8, math.MaxInt64)),
		int64(r.number(8, math.MaxInt64)), int64(r.number(8, math.MaxInt64)),
	}
}

func parseFreshCodecOracle(content FreshTemplateContent, player int64) (*CityState, map[int32]BuildingSpec, error) {
	invalid := errors.New("oracle: invalid FCT1 content")
	if player <= 0 || len(content.Bytes) < 52 || len(content.Bytes) > 262144 || content.EncodingVersion != 1 || sha256.Sum256(content.Bytes) != content.SHA256 {
		return nil, nil, invalid
	}
	r := &freshCodecOracle{data: content.Bytes}
	if string(r.take(8)) != "SGFCTPL\x00" || r.number(2, math.MaxUint16) != 1 {
		return nil, nil, invalid
	}
	labels := [3]string{r.text(64), r.text(64), r.text(64)}
	for _, label := range labels {
		if !regexp.MustCompile(`\A[A-Za-z0-9._-]{1,64}\z`).MatchString(label) {
			return nil, nil, invalid
		}
	}
	if (FreshTemplateVersions{labels[0], labels[1], labels[2]}) != content.Versions {
		return nil, nil, invalid
	}
	city := &CityState{PlayerID: player, Wallet: r.resources(), Buildings: make(map[string]*BuildingInstance)}
	buildings := r.number(2, 1024)
	if r.err != nil {
		return nil, nil, r.err
	}
	lastSlot := ""
	for i := uint64(0); i < buildings; i++ {
		slot := r.text(128)
		cfg := r.number(4, math.MaxInt32)
		level := r.number(4, math.MaxInt32)
		if r.err != nil || cfg == 0 || level == 0 || slot <= lastSlot || !utf8.ValidString(slot) || utf8.RuneCountInString(slot) > 32 || strings.ContainsRune(slot, 0) {
			return nil, nil, invalid
		}
		city.Buildings[slot] = &BuildingInstance{int32(cfg), int32(level)}
		lastSlot = slot
	}
	count := r.number(2, 1024)
	if r.err != nil {
		return nil, nil, r.err
	}
	catalog := make(map[int32]BuildingSpec)
	var lastID uint64
	for i := uint64(0); i < count; i++ {
		id := r.number(4, math.MaxInt32)
		duration := r.number(8, 9223372036)
		cost := r.resources()
		rate := r.number(8, math.MaxInt64)
		resource := r.number(1, 3)
		if r.err != nil || id <= lastID || duration == 0 {
			return nil, nil, invalid
		}
		catalog[int32(id)] = BuildingSpec{int32(id), int64(duration), cost, int64(rate), int8(resource)}
		lastID = id
	}
	if r.err != nil || r.offset != len(r.data) {
		return nil, nil, invalid
	}
	for _, building := range city.Buildings {
		if _, exists := catalog[building.CfgID]; !exists {
			return nil, nil, invalid
		}
	}
	return city, catalog, nil
}
