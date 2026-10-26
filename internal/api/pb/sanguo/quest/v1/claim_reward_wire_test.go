package questv1

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"os"
	"testing"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/descriptorpb"
	"google.golang.org/protobuf/types/dynamicpb"
)

func TestClaimRewardWireCompatibility(t *testing.T) {
	// Actual API source and ALL imports frozen at e767d1b12efed49d826badd32d93cf20b0243f98.
	// Never regenerate the baseline from the evolving runtime mirror.
	fixture := func(name, sum string) []byte {
		t.Helper()
		b, err := os.ReadFile("testdata/claim_reward_legacy." + name)
		if err != nil {
			t.Fatal(err)
		}
		if got := fmt.Sprintf("%x", sha256.Sum256(b)); got != sum {
			t.Fatalf("%s fixture changed: %s", name, got)
		}
		return b
	}
	set := new(descriptorpb.FileDescriptorSet)
	if err := proto.Unmarshal(fixture("pb", "0cfa3795de294ea732c0285f404f34e45672e39effa840533776b6ed25b867aa"), set); err != nil {
		t.Fatal(err)
	}
	files, err := protodesc.NewFiles(set) // No mutable GlobalFiles import resolver.
	if err != nil {
		t.Fatal(err)
	}
	file, err := files.FindFileByPath("sanguo/quest/v1/quest.proto")
	if err != nil {
		t.Fatal(err)
	}
	old := file.Messages().ByName("ClaimQuestRewardResponse")
	current := (&ClaimQuestRewardResponse{}).ProtoReflect().Descriptor()
	if old.FullName() != current.FullName() || old.Fields().Len() != 3 || current.Fields().Len() != 4 {
		t.Fatal("response shape drift")
	}
	for i := 0; i < 3; i++ {
		if !proto.Equal(protodesc.ToFieldDescriptorProto(old.Fields().Get(i)), protodesc.ToFieldDescriptorProto(current.Fields().Get(i))) {
			t.Fatalf("old field %d changed", i+1)
		}
	}
	level := current.Fields().ByNumber(4)
	if level.Name() != "player_level" || level.JSONName() != "playerLevel" || level.Kind() != protoreflect.Int32Kind || level.Cardinality() != protoreflect.Optional || level.HasPresence() || level.ContainingOneof() != nil {
		t.Fatal("field 4 must be ordinary proto3 int32")
	}
	// The rest of the complete API descriptor, not just fields 1-3, stays identical.
	next := protodesc.ToFileDescriptorProto(File_sanguo_quest_v1_quest_proto)
	for _, m := range next.MessageType {
		if m.GetName() == "ClaimQuestRewardResponse" {
			m.Field = m.Field[:3]
		}
	}
	if !proto.Equal(protodesc.ToFileDescriptorProto(file), next) {
		t.Fatal("unrelated quest schema drift")
	}
	marshal := func(m proto.Message) []byte {
		t.Helper()
		b, err := (proto.MarshalOptions{Deterministic: true}).Marshal(m)
		if err != nil {
			t.Fatal(err)
		}
		return b
	}
	baseline := fixture("bin", "28b07ae5231f8261626188841061b51791ab0400c9a730bd6f8a8bbb18215d15")
	legacy := dynamicpb.NewMessage(old)
	if err := proto.Unmarshal(baseline, legacy); err != nil {
		t.Fatal(err)
	}
	if len(legacy.GetUnknown()) != 0 || !bytes.Equal(marshal(legacy), baseline) {
		t.Fatal("invalid frozen old reply")
	}
	base := new(ClaimQuestRewardResponse)
	if err := proto.Unmarshal(baseline, base); err != nil {
		t.Fatal(err)
	}
	if base.GetPlayerLevel() != 0 || !bytes.Equal(marshal(base), baseline) {
		t.Fatal("old reply must decode as level 0 with fields 1-3 byte-identical")
	}
	for _, value := range []int32{0, 1, 5, 20, 2147483647, -2147483648} {
		t.Run(fmt.Sprint(value), func(t *testing.T) {
			msg := proto.Clone(base).(*ClaimQuestRewardResponse)
			msg.PlayerLevel = value
			encoded := marshal(msg)
			t.Logf("Go wire level=%d: %x", value, encoded)
			decoded := new(ClaimQuestRewardResponse)
			if err := proto.Unmarshal(encoded, decoded); err != nil {
				t.Fatal(err)
			}
			if !proto.Equal(msg, decoded) || !bytes.Equal(encoded, marshal(decoded)) {
				t.Fatal("int32 value or old fields lost")
			}
			oldDecoded := dynamicpb.NewMessage(old)
			if err := (proto.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(encoded, oldDecoded); err != nil {
				t.Fatal(err)
			}
			if !proto.Equal(legacy, oldDecoded) || !bytes.Equal(baseline, marshal(oldDecoded)) {
				t.Fatal("old decoder must ignore new field 4 and preserve fields 1-3")
			}
		})
	}
	if got := marshal(&ClaimQuestRewardResponse{PlayerLevel: 20}); !bytes.Equal(got, []byte{0x20, 0x14}) {
		t.Fatalf("field 4 wire: %x", got)
	}
	if len(marshal(&ClaimQuestRewardResponse{PlayerLevel: 0})) != 0 || (*ClaimQuestRewardResponse)(nil).GetPlayerLevel() != 0 {
		t.Fatal("ordinary scalar zero/default changed")
	}
}
