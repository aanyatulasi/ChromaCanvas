import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

// Fraunces carries the whole "premium creative tool" impression — it is the
// only place the product allows itself any flourish. Restricted to display
// sizes; everything functional is Inter.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChromaCanvas — Paint a picture. Compose a piano piece.",
  description:
    "An interactive painting experience. Every brushstroke becomes a melody; the finished painting performs itself on a grand piano.",
};

/**
 * Painting on a touch screen fights the browser's own gestures. Pinch-zoom
 * would fire mid-stroke, double-tap would zoom instead of erasing, and the
 * on-screen keyboard resizing the layout would resize the canvas underneath a
 * drag. Locking the viewport is the one place where disabling user scaling is
 * the accessible choice — the alternative is a drawing surface that cannot be
 * drawn on.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
  // Lets the layout reach under a phone's rounded corners and home indicator,
  // which is also what makes `env(safe-area-inset-*)` report anything but zero.
  viewportFit: "cover",
  themeColor: "#141416",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
