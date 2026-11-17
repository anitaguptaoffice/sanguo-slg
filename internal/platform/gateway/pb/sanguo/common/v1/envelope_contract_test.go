package commonv1

import (
	"bytes"
	"encoding/hex"
	"os"
	"regexp"
	"strconv"
	"testing"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

func TestEnvelopeCanonicalErrorCodes(t *testing.T) {
	source, err := os.ReadFile("../../../../../../../spec/proto/sanguo/common/v1/envelope.proto")
	if err != nil {
		t.Fatal(err)
	}
	entries := regexp.MustCompile(`(?m)^\s*([A-Z][A-Z_0-9]*) = ([0-9]+);`).FindAllSubmatch(source, -1)
	descriptor := ErrorCode(0).Descriptor()
	if len(entries) != 55 || descriptor.Values().Len() != len(entries) || len(ErrorCode_name) != len(entries) || len(ErrorCode_value) != len(entries) {
		t.Fatalf("canonical/generated cardinality: source=%d descriptor=%d names=%d values=%d", len(entries), descriptor.Values().Len(), len(ErrorCode_name), len(ErrorCode_value))
	}
	for _, entry := range entries {
		name := string(entry[1])
		n, err := strconv.ParseInt(string(entry[2]), 10, 32)
		if err != nil {
			t.Fatal(err)
		}
		number := int32(n)
		t.Run(name, func(t *testing.T) {
			value, ok := ErrorCode_value[name]
			if !ok || value != number || ErrorCode_name[number] != name || ErrorCode(number).String() != name {
				t.Fatalf("generated maps/string disagree: %s=%d", name, number)
			}
			byName := descriptor.Values().ByName(protoreflect.Name(name))
			byNumber := descriptor.Values().ByNumber(protoreflect.EnumNumber(number))
			if byName == nil || byNumber == nil || int32(byName.Number()) != number || string(byNumber.Name()) != name {
				t.Fatalf("reflection disagrees: %s=%d", name, number)
			}
			packet := &ServerPacket{Code: number}
			wire, err := proto.Marshal(packet)
			if err != nil {
				t.Fatal(err)
			}
			var decoded ServerPacket
			if err := proto.Unmarshal(wire, &decoded); err != nil || !proto.Equal(packet, &decoded) {
				t.Fatalf("code roundtrip: %v", err)
			}
		})
	}
}

func TestEnvelopeMessageDescriptors(t *testing.T) {
	file := File_sanguo_common_v1_envelope_proto
	if file.Path() != "sanguo/common/v1/envelope.proto" || file.Package() != "sanguo.common.v1" || file.Syntax() != protoreflect.Proto3 || file.Messages().Len() != 2 || file.Enums().Len() != 1 {
		t.Fatal("envelope file identity changed")
	}
	cases := []struct {
		message proto.Message
		names   []protoreflect.Name
		kinds   []protoreflect.Kind
	}{
		{&ClientPacket{}, []protoreflect.Name{"route", "payload", "trace_id", "session_id", "server_id"}, []protoreflect.Kind{protoreflect.StringKind, protoreflect.BytesKind, protoreflect.StringKind, protoreflect.StringKind, protoreflect.Int32Kind}},
		{&ServerPacket{}, []protoreflect.Name{"code", "msg", "data", "trace_id"}, []protoreflect.Kind{protoreflect.Int32Kind, protoreflect.StringKind, protoreflect.BytesKind, protoreflect.StringKind}},
	}
	for _, tc := range cases {
		d := tc.message.ProtoReflect().Descriptor()
		if d.Fields().Len() != len(tc.names) || d.Oneofs().Len() != 0 {
			t.Fatalf("%s fields changed", d.FullName())
		}
		for i, name := range tc.names {
			f := d.Fields().ByName(name)
			if f == nil || f.Number() != protoreflect.FieldNumber(i+1) || f.Kind() != tc.kinds[i] || f.Cardinality() != protoreflect.Optional || f.HasPresence() {
				t.Fatalf("%s.%s descriptor changed", d.FullName(), name)
			}
		}
	}
}

func TestEnvelopeWireCompatibility(t *testing.T) {
	cases := []struct {
		name string
		msg  proto.Message
		hex  string
	}{
		{"legacy client", &ClientPacket{Route: "r", Payload: []byte{1, 2}, TraceId: "t", SessionId: "s", ServerId: 7}, "0a0172120201021a01742201732807"},
		{"legacy server", &ServerPacket{Code: 10001, Msg: "m", Data: []byte{1, 2}, TraceId: "t"}, "08914e12016d1a020102220174"},
		{"intent conflict", &ServerPacket{Code: 50008}, "08d88603"},
		{"unknown positive", &ServerPacket{Code: 2147483647}, "08ffffffff07"},
		{"unknown negative", &ServerPacket{Code: -1}, "08ffffffffffffffffff01"},
		{"default client", &ClientPacket{}, ""},
		{"default server", &ServerPacket{}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			want, err := hex.DecodeString(tc.hex)
			if err != nil {
				t.Fatal(err)
			}
			got, err := proto.Marshal(tc.msg)
			if err != nil || !bytes.Equal(got, want) {
				t.Fatalf("wire=%x want=%x error=%v", got, want, err)
			}
			decoded := tc.msg.ProtoReflect().New().Interface()
			if err := proto.Unmarshal(want, decoded); err != nil || !proto.Equal(tc.msg, decoded) {
				t.Fatalf("fixture decode: %v", err)
			}
			// Unknown field 99 remains forward-compatible in both envelope types.
			withUnknown := append(append([]byte(nil), want...), 0x98, 0x06, 0x7b)
			if err := proto.Unmarshal(withUnknown, decoded); err != nil {
				t.Fatal(err)
			}
			roundtrip, err := proto.Marshal(decoded)
			if err != nil || !bytes.Equal(roundtrip, withUnknown) {
				t.Fatalf("unknown-field roundtrip: %x, %v", roundtrip, err)
			}
		})
	}
	for _, n := range []int32{-1, 2147483647} {
		if ErrorCode(n).String() != strconv.FormatInt(int64(n), 10) || ErrorCode(n).Descriptor().Values().ByNumber(protoreflect.EnumNumber(n)) != nil {
			t.Fatalf("unknown enum integer %d changed", n)
		}
	}
	var client *ClientPacket
	var server *ServerPacket
	if client.GetRoute() != "" || client.GetPayload() != nil || client.GetTraceId() != "" || client.GetSessionId() != "" || client.GetServerId() != 0 || server.GetCode() != 0 || server.GetMsg() != "" || server.GetData() != nil || server.GetTraceId() != "" || ErrorCode(0).String() != "ERROR_CODE_UNSPECIFIED" {
		t.Fatal("nil/default getters changed")
	}
}
