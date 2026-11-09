import protobuf from "protobufjs";
import { ENTRY_RESPONSE, entryAccountIdentity } from "./authenticatedIdentity";

const INT64_TYPES = new Set(["int64", "uint64", "sint64", "fixed64", "sfixed64"]);

/** Keep protobuf defaults/enums/bytes, but never leak Long objects into number-based UI models. */
export function decodeGatewayResponse(type: protobuf.Type, bytes: Uint8Array): Record<string, unknown> {
  const isEntry = type.fullName === ENTRY_RESPONSE;
  const accountId = isEntry ? entryAccountIdentity(bytes) : null;
  const value = type.toObject(type.decode(bytes), { longs: String, defaults: true, arrays: true, objects: true });
  if (isEntry) value.account_id = accountId;
  function visit(message: Record<string, unknown>, schema: protobuf.Type, path: string): void {
    schema.resolveAll();
    for (const field of schema.fieldsArray) {
      const convert = (item: unknown, itemPath: string): unknown => {
        if (item == null || (isEntry && schema === type && field.name === "account_id")) return item;
        if (INT64_TYPES.has(field.type)) {
          const exact = BigInt(String(item));
          if (exact > BigInt(Number.MAX_SAFE_INTEGER) || exact < BigInt(Number.MIN_SAFE_INTEGER)) {
            throw new RangeError(`Gateway integer outside safe range: ${itemPath}`);
          }
          return Number(exact);
        }
        if (field.resolvedType instanceof protobuf.Type) visit(item as Record<string, unknown>, field.resolvedType, itemPath);
        return item;
      };
      const item = message[field.name];
      if (field.map && item != null) {
        for (const key of Object.keys(item as object)) {
          const map = item as Record<string, unknown>;
          map[key] = convert(map[key], `${path}.${field.name}[${key}]`);
        }
      } else if (field.repeated && Array.isArray(item)) {
        message[field.name] = item.map((entry, index) => convert(entry, `${path}.${field.name}[${index}]`));
      } else {
        message[field.name] = convert(item, `${path}.${field.name}`);
      }
    }
  }
  visit(value, type, type.fullName);
  return value;
}
