import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package.json in the home directory makes Next infer the wrong
  // workspace root. Pinning it keeps dev and build resolving from this
  // project only.
  turbopack: {
    root: __dirname,
  },
  // The dev badge defaults to bottom-left, directly on top of the transport's
  // play button, where it silently swallows clicks. Nothing interactive lives
  // in the bottom-right.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
