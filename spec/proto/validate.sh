#!/usr/bin/env bash
# SPEC-002: 校验 spec/proto 下所有 .proto 可被 protoc 解析
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PROTO_ROOT="$ROOT"

if ! command -v protoc >/dev/null 2>&1; then
  echo "ERROR: protoc not found; install protobuf compiler" >&2
  exit 1
fi

mapfile -t FILES < <(find "$PROTO_ROOT/sanguo" -name '*.proto' | sort)
if [ "${#FILES[@]}" -eq 0 ]; then
  echo "ERROR: no .proto files under $PROTO_ROOT/sanguo" >&2
  exit 1
fi

echo "Validating ${#FILES[@]} proto file(s)..."
protoc -I "$PROTO_ROOT" --descriptor_set_out=/dev/null "${FILES[@]}"
echo "All proto files passed protoc check."
