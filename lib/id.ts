/**
 * Short unique ids for strokes and paintings.
 *
 * `crypto.randomUUID` needs a secure context, which a phone hitting a LAN dev
 * server over plain http is not, so this falls back rather than throwing.
 */
export function createId(prefix = ""): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  return prefix ? `${prefix}_${raw}` : raw;
}
