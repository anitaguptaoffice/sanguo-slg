package api

import (
	"encoding/base64"
	"testing"

	militaryv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

func TestReturnedMarchWireContract(t *testing.T) {
	values := []militaryv1.MarchPhase{
		militaryv1.MarchPhase_MARCH_PHASE_UNSPECIFIED,
		militaryv1.MarchPhase_MARCH_PHASE_PENDING,
		militaryv1.MarchPhase_MARCH_PHASE_MARCHING,
		militaryv1.MarchPhase_MARCH_PHASE_ARRIVED,
		militaryv1.MarchPhase_MARCH_PHASE_RETURNING,
		militaryv1.MarchPhase_MARCH_PHASE_RETURNED,
	}
	for number, value := range values {
		if int(value) != number {
			t.Fatalf("phase %s changed wire value: got %d want %d", value, value, number)
		}
	}
	fields := (&militaryv1.MarchSummary{}).ProtoReflect().Descriptor().Fields()
	names := []protoreflect.Name{"march_id", "army_id", "origin_city_id", "from_x", "from_y", "to_x", "to_y", "purpose", "phase", "depart_at_ms", "arrive_at_ms", "return_finish_at_ms", "troops"}
	if fields.Len() != len(names) {
		t.Fatalf("summary field count: %d", fields.Len())
	}
	for i, name := range names {
		field := fields.ByName(name)
		if field == nil || int(field.Number()) != i+1 {
			t.Fatalf("summary field %s changed number", name)
		}
	}
	for _, value := range []militaryv1.MarchPhase{5, 127} {
		t.Run(value.String(), func(t *testing.T) {
			encoded, err := proto.Marshal(&militaryv1.MarchSummary{Phase: value})
			if err != nil {
				t.Fatal(err)
			}
			if len(encoded) != 2 || encoded[0] != 0x48 || encoded[1] != byte(value) {
				t.Fatalf("phase field9 wire changed: %x", encoded)
			}
			var decoded militaryv1.MarchSummary
			if err := proto.Unmarshal(encoded, &decoded); err != nil || decoded.Phase != value {
				t.Fatalf("numeric phase roundtrip: %v, %v", decoded.Phase, err)
			}
		})
	}
	response := &militaryv1.ListMarchesResponse{
		Total: 4,
		Marches: []*militaryv1.MarchSummary{
			{MarchId: 11, ArmyId: 21, OriginCityId: 31, Phase: 5, DepartAtMs: 1000, ArriveAtMs: 2000},
			{MarchId: 12, ArmyId: 22, OriginCityId: 31, Phase: 1},
			{MarchId: 13, ArmyId: 23, OriginCityId: 31, Phase: 4, ReturnFinishAtMs: 3000},
			{MarchId: 14, ArmyId: 24, OriginCityId: 31, Phase: 127},
		},
	}
	encoded, err := proto.Marshal(response)
	if err != nil {
		t.Fatal(err)
	}
	var decoded militaryv1.ListMarchesResponse
	if err := proto.Unmarshal(encoded, &decoded); err != nil || !proto.Equal(response, &decoded) {
		t.Fatalf("mixed history roundtrip failed: %v", err)
	}
	t.Logf("ListMarchesResponse Go wire fixture base64=%s", base64.StdEncoding.EncodeToString(encoded))
}
