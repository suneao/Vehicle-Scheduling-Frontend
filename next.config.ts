import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://39.108.77.178:8001/api/:path*",
      },
    ]
  },
}

export default nextConfig
