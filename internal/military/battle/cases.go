package battle

// BaselineInputs returns the fixed 100-case regression inputs (deterministic).
func BaselineInputs() []BattleInput {
	out := make([]BattleInput, 100)
	for i := 0; i < 100; i++ {
		out[i] = syntheticInput(i)
	}
	return out
}

func syntheticInput(i int) BattleInput {
	types := AllTroopTypes
	a0 := (i*3 + 7) % 41
	a1 := (i*5 + 11) % 31
	a2 := (i*7 + 13) % 23
	a3 := (i*11 + 17) % 17
	d0 := (i*13 + 19) % 37
	d1 := (i*17 + 23) % 29
	d2 := (i*19 + 29) % 19
	d3 := (i*23 + 31) % 13

	att := map[TroopType]int{
		types[0]: a0,
		types[1]: a1,
		types[2]: a2,
		types[3]: a3,
	}
	def := map[TroopType]int{
		types[0]: d0,
		types[1]: d1,
		types[2]: d2,
		types[3]: d3,
	}
	if troopTotal(att) == 0 {
		att[types[i%4]] = 1 + i%5
	}
	if troopTotal(def) == 0 {
		def[types[(i+1)%4]] = 1 + i%7
	}

	heroA := i % 21
	heroD := (i * 2) % 21
	moraleA := moraleMin + float64(i%13)/100.0
	moraleD := moraleMax - float64(i%11)/100.0

	battleID := "mil001-baseline-" + itoa(i)
	attID := "att-" + itoa(i%50)
	defID := "def-" + itoa((i*3)%50)
	if i%17 == 0 {
		attID, defID = defID, attID
	}

	return BattleInput{
		BattleID:   battleID,
		AttackerID: attID,
		DefenderID: defID,
		Attacker: Army{
			Troops:    att,
			HeroLevel: heroA,
			Morale:    moraleA,
		},
		Defender: Army{
			Troops:    def,
			HeroLevel: heroD,
			Morale:    moraleD,
		},
	}
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [16]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}
