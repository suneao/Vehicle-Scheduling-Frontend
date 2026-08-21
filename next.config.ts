import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://39.108.77.178:8001/api/:path*",
      },
      {
        source: "/admin/maps",
        destination: "http://39.108.77.178:8001/admin/maps/",
      },
      {
        source: "/admin/paths",
        destination: "http://39.108.77.178:8001/admin/paths/",
      },
      {
        source: "/admin/sites",
        destination: "http://39.108.77.178:8001/admin/sites/",
      },
      {
        source: "/admin/waypoints",
        destination: "http://39.108.77.178:8001/admin/waypoints/",
      },
      {
        // 详情/更新/删除路径（如 /admin/paths/1）：原样转发，不带尾斜杠
        source: "/admin/:path*",
        destination: "http://39.108.77.178:8001/admin/:path*",
      },
      {
        source: "/report/:path*",
        destination: "http://39.108.77.178:8001/report/:path*",
      },
    ]
  },
}

export default nextConfig
