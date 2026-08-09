/**
 * The paint palette.
 *
 * Seven pigments, hand-picked as muted gouache rather than screen primaries so
 * they sit naturally on warm off-white paper and stay distinguishable from each
 * other at brush width. This is deliberately a fixed set and not a colour
 * picker: every pigment carries a musical personality, and an arbitrary hue
 * would have no voice to speak with.
 *
 * The hex values are duplicated in `app/globals.css` as `--color-paint-*` so
 * Tailwind can generate utilities from them; this module is the source the
 * canvas and the music engine read at runtime.
 */

export const PAINT_IDS = [
  "blue",
  "yellow",
  "red",
  "green",
  "purple",
  "orange",
  "pink",
] as const;

export type PaintId = (typeof PAINT_IDS)[number];

export type Paint = {
  id: PaintId;
  label: string;
  hex: string;
  /** One line on how this pigment plays the piano. Shown on hover. */
  character: string;
};

export const PAINTS: Paint[] = [
  {
    id: "blue",
    label: "Cobalt",
    hex: "#3b6ea5",
    character: "gentle, flowing, legato",
  },
  {
    id: "yellow",
    label: "Ochre",
    hex: "#e3b23c",
    character: "light, playful, slightly staccato",
  },
  {
    id: "red",
    label: "Vermilion",
    hex: "#c1453b",
    character: "confident, expressive, rhythmically strong",
  },
  {
    id: "green",
    label: "Verdigris",
    hex: "#5c8a5a",
    character: "calm, balanced, lyrical",
  },
  {
    id: "purple",
    label: "Amethyst",
    hex: "#7a5c99",
    character: "spacious, reflective, harmonically rich",
  },
  {
    id: "orange",
    label: "Sienna",
    hex: "#d97a3c",
    character: "warm, energetic, moderately rhythmic",
  },
  {
    id: "pink",
    label: "Rose",
    hex: "#d98ba8",
    character: "delicate, bright, graceful",
  },
];

const BY_ID = new Map<PaintId, Paint>(PAINTS.map((p) => [p.id, p]));

/** Falls back to the first pigment so a corrupt saved painting still renders. */
export function getPaint(id: PaintId): Paint {
  return BY_ID.get(id) ?? PAINTS[0];
}

export const DEFAULT_PAINT_ID: PaintId = "blue";
