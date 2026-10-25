package domesticv1

import (
	"bytes"
	"os"
	"testing"

	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/descriptorpb"
	"google.golang.org/protobuf/types/dynamicpb"
)

func TestGarrisonWireCompatibility(t *testing.T) {
	// Fixture generated from actual pre-extension API extra.proto at 1c5a0912.
	raw, err := os.ReadFile("testdata/get_city_state_legacy.pb")
	if err != nil {
		t.Fatal(err)
	}
	set := new(descriptorpb.FileDescriptorSet)
	if err := proto.Unmarshal(raw, set); err != nil {
		t.Fatal(err)
	}
	file, err := protodesc.NewFile(set.File[0], protoregistry.GlobalFiles)
	if err != nil {
		t.Fatal(err)
	}
	old := file.Messages().ByName("GetCityStateResponse")
	current := (&GetCityStateResponse{}).ProtoReflect().Descriptor()
	if old.Fields().Len() != 3 || current.Fields().Len() != 4 {
		t.Fatal("response shape drift")
	}
	for i := 0; i < 3; i++ {
		if !proto.Equal(protodesc.ToFieldDescriptorProto(old.Fields().Get(i)), protodesc.ToFieldDescriptorProto(current.Fields().Get(i))) {
			t.Fatalf("old field %d changed", i+1)
		}
	}
	marshal := func(m proto.Message) []byte {
		t.Helper()
		b, err := (proto.MarshalOptions{Deterministic: true}).Marshal(m)
		if err != nil {
			t.Fatal(err)
		}
		return b
	}
	base := &GetCityStateResponse{
		Wallet:          &commonv1.ResourceWallet{Food: 9007199254740993, Wood: 202, Iron: 303, Stone: 404, Gold: 505},
		Buildings:       []*commonv1.CityBuilding{{SlotKey: "barracks", BuildingCfgId: 1001, Level: 1, UpgradeFinishAtMs: 1793037000123}},
		ProductionRates: &commonv1.ResourceWallet{Food: 11, Wood: 22, Iron: 33, Stone: 44},
	}
	legacy := dynamicpb.NewMessage(old)
	if err := proto.Unmarshal(marshal(base), legacy); err != nil {
		t.Fatal(err)
	}
	baseline := marshal(legacy)
	if !bytes.Equal(baseline, marshal(base)) {
		t.Fatal("fields 1-3 binary drift")
	}
	for _, tc := range []struct {
		name     string
		snapshot *CityGarrisonSnapshot
	}{
		{"absent", nil}, {"present-empty", &CityGarrisonSnapshot{}},
		{"ready-only", &CityGarrisonSnapshot{Troops: []*ReadyTroopCount{{UnitCfgId: 1001, Count: 1}, {UnitCfgId: 1002, Count: 2147483647}}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			msg := proto.Clone(base).(*GetCityStateResponse)
			msg.Garrison = tc.snapshot
			encoded := marshal(msg)
			t.Logf("Go wire %s: %x", tc.name, encoded)
			decoded := new(GetCityStateResponse)
			if err := proto.Unmarshal(encoded, decoded); err != nil {
				t.Fatal(err)
			}
			if !proto.Equal(msg, decoded) || (decoded.Garrison == nil) != (tc.snapshot == nil) {
				t.Fatal("snapshot presence/value lost")
			}
			if !bytes.Equal(encoded, marshal(decoded)) {
				t.Fatal("re-encode changed bytes")
			}
			oldDecoded := dynamicpb.NewMessage(old)
			if err := (proto.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(encoded, oldDecoded); err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(baseline, marshal(oldDecoded)) {
				t.Fatal("legacy decoder lost wallet/buildings/rates")
			}
		})
	}
	if got := marshal(&GetCityStateResponse{}); len(got) != 0 {
		t.Fatalf("absent=%x", got)
	}
	if got := marshal(&GetCityStateResponse{Garrison: &CityGarrisonSnapshot{}}); !bytes.Equal(got, []byte{0x22, 0}) {
		t.Fatalf("present-empty=%x", got)
	}
	row := (&ReadyTroopCount{}).ProtoReflect().Descriptor()
	if row.FullName() != "sanguo.domestic.v1.ReadyTroopCount" || row.Fields().Len() != 2 || row.Fields().ByName("wounded") != nil {
		t.Fatal("ready-only DTO drift")
	}
}
