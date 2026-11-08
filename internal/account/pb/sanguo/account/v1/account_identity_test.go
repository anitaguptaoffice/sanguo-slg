package accountv1

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"

	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/dynamicpb"
)

func identityBytes(t *testing.T, value string) []byte {
	t.Helper()
	b, err := hex.DecodeString(value)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func identityMarshal(t *testing.T, m proto.Message) []byte {
	t.Helper()
	b, err := (proto.MarshalOptions{Deterministic: true}).Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func identityLegacyDescriptor(t *testing.T) protoreflect.MessageDescriptor {
	t.Helper()
	fd := protodesc.ToFileDescriptorProto(File_sanguo_account_v1_account_proto)
	for _, m := range fd.MessageType {
		if m.GetName() != "EnterGameServerResponse" {
			continue
		}
		if len(m.Field) != 6 {
			t.Fatalf("response fields = %d", len(m.Field))
		}
		f := m.Field[5]
		if f.GetName() != "account_id" || f.GetNumber() != 6 || f.GetType().String() != "TYPE_INT64" || f.GetLabel().String() != "LABEL_OPTIONAL" || f.GetJsonName() != "accountId" {
			t.Fatalf("unexpected field 6: %v", f)
		}
		m.Field = m.Field[:5]
	}
	// Independently extracted from the untouched pre-SPEC generated raw descriptor.
	const baseline = "72302f091cc728d60fb0e64c7bfd53720650083bf4f73bfa7a3fc7f7206b3e2a"
	if got := fmt.Sprintf("%x", sha256.Sum256(identityMarshal(t, fd))); got != baseline {
		t.Fatalf("baseline account descriptor changed: %s", got)
	}
	legacy, err := protodesc.NewFile(fd, protoregistry.GlobalFiles)
	if err != nil {
		t.Fatal(err)
	}
	return legacy.Messages().ByName("EnterGameServerResponse")
}

func TestAccountIdentityDescriptor(t *testing.T) {
	identityLegacyDescriptor(t)
}

func TestAccountIdentityLegacyWire(t *testing.T) {
	old := &EnterGameServerResponse{
		SessionId:          "s",
		ServerId:           2,
		Player:             &commonv1.PlayerProfile{ServerId: 2, PlayerId: 3, DisplayName: "n", Level: 4, Power: 5},
		Wallet:             &commonv1.ResourceWallet{Food: 6, Wood: 7, Iron: 8, Stone: 9, Gold: 10},
		SessionExpiresAtMs: 11,
	}
	golden := identityBytes(t, "0a017310021a0b080210031a016e20042805220a0806100718082009280a280b")
	if got := identityMarshal(t, old); !bytes.Equal(got, golden) {
		t.Fatalf("old wire: %x", got)
	}
	fresh := proto.Clone(old).(*EnterGameServerResponse)
	fresh.AccountId = 12
	wire := append(append([]byte{}, golden...), 0x30, 0x0c)
	if got := identityMarshal(t, fresh); !bytes.Equal(got, wire) {
		t.Fatalf("new wire: %x", got)
	}
	var fromOld EnterGameServerResponse
	if err := proto.Unmarshal(golden, &fromOld); err != nil {
		t.Fatal(err)
	}
	if !proto.Equal(old, &fromOld) || fromOld.GetAccountId() != 0 {
		t.Fatal("legacy fields changed")
	}
	legacy := identityLegacyDescriptor(t)
	for _, input := range [][]byte{wire, append([]byte{0x30, 0x0c}, golden...)} {
		reader := dynamicpb.NewMessage(legacy)
		if err := proto.Unmarshal(input, reader); err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(reader.GetUnknown(), []byte{0x30, 0x0c}) {
			t.Fatal("legacy lost identity unknown field")
		}
		var roundtrip EnterGameServerResponse
		if err := proto.Unmarshal(identityMarshal(t, reader), &roundtrip); err != nil {
			t.Fatal(err)
		}
		if !proto.Equal(fresh, &roundtrip) {
			t.Fatal("legacy roundtrip changed fields")
		}
		reader.SetUnknown(nil)
		if got := identityMarshal(t, reader); !bytes.Equal(got, golden) {
			t.Fatalf("legacy known fields: %x", got)
		}
	}
}

func TestAccountIdentityInt64Wire(t *testing.T) {
	// Codec representation accepts negatives; authenticated positivity belongs to the producer.
	for _, tc := range []struct {
		id   int64
		wire string
	}{
		{1, "3001"}, {9007199254740991, "30ffffffffffffff0f"},
		{9007199254740992, "308080808080808010"}, {9007199254740993, "308180808080808010"},
		{9223372036854775807, "30ffffffffffffffff7f"},
		{-1, "30ffffffffffffffffff01"}, {-9223372036854775808, "3080808080808080808001"},
	} {
		t.Run(fmt.Sprint(tc.id), func(t *testing.T) {
			wire := identityBytes(t, tc.wire)
			if got := identityMarshal(t, &EnterGameServerResponse{AccountId: tc.id}); !bytes.Equal(got, wire) {
				t.Fatalf("wire: %x", got)
			}
			var decoded EnterGameServerResponse
			if err := proto.Unmarshal(wire, &decoded); err != nil {
				t.Fatal(err)
			}
			if decoded.GetAccountId() != tc.id {
				t.Fatalf("identity: %d", decoded.GetAccountId())
			}
			if got := identityMarshal(t, &decoded); !bytes.Equal(got, wire) {
				t.Fatalf("roundtrip: %x", got)
			}
		})
	}
}

func TestAccountIdentityZeroDefault(t *testing.T) {
	var absent *EnterGameServerResponse
	if absent.GetAccountId() != 0 {
		t.Fatal("nil getter")
	}
	for _, wire := range [][]byte{nil, {0x30, 0x00}} {
		var decoded EnterGameServerResponse
		if err := proto.Unmarshal(wire, &decoded); err != nil {
			t.Fatal(err)
		}
		if decoded.GetAccountId() != 0 || len(identityMarshal(t, &decoded)) != 0 {
			t.Fatal("zero/default wire")
		}
	}
}

func TestAccountIdentityUnknownWire(t *testing.T) {
	wire := identityBytes(t, "300c980607") // Identity12 plus unknown varint field99=7.
	var decoded EnterGameServerResponse
	if err := proto.Unmarshal(wire, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.GetAccountId() != 12 || !bytes.Equal(decoded.ProtoReflect().GetUnknown(), wire[2:]) {
		t.Fatal("unknown field changed")
	}
	if got := identityMarshal(t, &decoded); !bytes.Equal(got, wire) {
		t.Fatalf("unknown roundtrip: %x", got)
	}
}

func TestAccountIdentityMalformedWire(t *testing.T) {
	for _, wire := range []string{"30", "3080", "30808080808080808080", "308080808080808080808002"} {
		t.Run(wire, func(t *testing.T) {
			var decoded EnterGameServerResponse
			if err := proto.Unmarshal(identityBytes(t, wire), &decoded); err == nil {
				t.Fatal("accepted malformed identity")
			}
		})
	}
}
