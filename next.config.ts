import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev server is normally reached at localhost:3000; 127.0.0.1 is also used
  // deliberately for testing the Spotify OAuth loopback redirect.
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co",
      },
    ],
  },
};

export default nextConfig;
