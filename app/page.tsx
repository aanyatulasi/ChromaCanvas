import Link from "next/link";
import { PAINTS } from "@/lib/paint/palette";

/**
 * Landing page.
 *
 * The whole idea has to land in about two seconds: a warm sheet of paper with
 * paint on it, and a promise that the paint is music. Milestone 1 replaces the
 * static sheet below with a real demo painting whose strokes illuminate while
 * its composition plays.
 */
export default function LandingPage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* A single soft pool of light behind the artwork, so the page reads as a
          dim room with one lit object in it rather than a flat dark screen. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-18rem] h-[38rem] w-[68rem] -translate-x-1/2 rounded-full opacity-45 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(201,162,39,0.20), transparent)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <span className="font-display text-lg tracking-tight">
          Chroma<span className="text-brass">Canvas</span>
        </span>
        <Link
          href="/paint"
          className="text-sm text-ink-muted transition-colors duration-200 hover:text-ink"
        >
          Open the studio
        </Link>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-8 pb-20 pt-10 text-center">
        <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Paint a picture.
          <br />
          <span className="text-brass">Compose a piano piece.</span>
        </h1>

        <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-muted">
          Every brushstroke becomes a melody. Create a painting, then hear it
          performed on a grand piano.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/paint"
            className="rounded-full bg-ink px-7 py-3 text-sm font-medium text-shell transition-transform duration-200 ease-soft hover:scale-[1.03]"
          >
            Start Painting
          </Link>
          <Link
            href="/paint?demo=ocean-light"
            className="rounded-full border border-hairline px-7 py-3 text-sm font-medium text-ink transition-colors duration-200 hover:border-ink-faint hover:bg-panel"
          >
            Watch a Demo
          </Link>
        </div>

        {/* The paper surface, front and centre. */}
        <div className="paper mt-16 aspect-[16/9] w-full max-w-4xl rounded-2xl" />

        <div className="mt-10 flex items-center gap-3">
          {PAINTS.map((paint) => (
            <span
              key={paint.id}
              title={`${paint.label} — ${paint.character}`}
              className="h-3.5 w-3.5 rounded-full"
              style={{ backgroundColor: paint.hex }}
            />
          ))}
          <span className="ml-2 text-xs uppercase tracking-[0.18em] text-ink-faint">
            Seven pigments, one grand piano
          </span>
        </div>
      </div>
    </main>
  );
}
