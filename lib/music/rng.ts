/**
 * Seeded randomness.
 *
 * Every musical choice in ChromaCanvas runs through this file. Nothing is
 * allowed to call `Math.random`, because the product promises that the same
 * painting always produces the same composition — undo a stroke, restore it,
 * reload the page a month later, and the melody has to be identical.
 */

/** mulberry32 — small, fast, and good enough for musical decisions. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mix values into a stable 32-bit seed. Order matters; `hash(1,2) !== hash(2,1)`. */
export function hashSeed(...values: (number | string)[]): number {
  let h = 2166136261 >>> 0;
  for (const value of values) {
    const text = typeof value === "number" ? value.toString(36) : value;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    // Separator, so hash("ab","c") and hash("a","bc") differ.
    h ^= 0x2f;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Pick one item, deterministically. */
export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

/** A float in [min, max). */
export function range(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}
