/**
 * IDs are generated on the client, never by a database.
 *
 * This is what makes offline creation work today and sync work later: a task
 * created with no network already carries its permanent identity, so the v2
 * migration is a straight copy with no ID remapping. Never reach for an
 * auto-incrementing integer for anything that will one day sync.
 */
export function newId(): string {
  // Available in every browser we support, but only over HTTPS or localhost.
  // Testing on a phone against a LAN IP lands on plain http, so keep a path.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return uuidV4Fallback();
}

function uuidV4Fallback(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Set the version (4) and variant (RFC 4122) bits.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
