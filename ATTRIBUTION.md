# Attribution

ChromaCanvas is built on work by other people. This file records what, and under
which terms.

## Grand piano samples

**Salamander Grand Piano** (Yamaha C5) by **Alexander Holm**, licensed under
[Creative Commons Attribution 3.0 Unported (CC BY 3.0)](https://creativecommons.org/licenses/by/3.0/).

- Source: https://archive.org/details/SalamanderGrandPianoV3
- The 30-sample subset bundled here was taken from the Tone.js sample mirror at
  https://tonejs.github.io/audio/salamander/
- Bundled at [`public/audio/piano/`](public/audio/piano/), with the full licence
  notice in [`public/audio/piano/LICENSE.txt`](public/audio/piano/LICENSE.txt).

CC BY 3.0 permits commercial use and modification, and requires only that the
author is credited. If you fork or redeploy this project, keep that credit.

## Typefaces

- **Fraunces** — Open Font License 1.1, by Phaedra Charles and Flavia Zimbardi.
- **Inter** — Open Font License 1.1, by Rasmus Andersson.

Both are served through `next/font/google`, which self-hosts them at build time.

## Libraries

Standard open-source dependencies, each under its own licence as recorded in
`package-lock.json`. The ones doing the heaviest lifting:

- [Tone.js](https://tonejs.github.io/) — MIT — audio scheduling and sampling
- [perfect-freehand](https://github.com/steveruizok/perfect-freehand) — MIT — brush outlines
- [Next.js](https://nextjs.org/) — MIT
- [Zustand](https://github.com/pmndrs/zustand) — MIT
- [idb-keyval](https://github.com/jakearchibald/idb-keyval) — Apache-2.0
- [Lucide](https://lucide.dev/) — ISC — icons
