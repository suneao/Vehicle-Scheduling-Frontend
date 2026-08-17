import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://39.108.77.178:8001/api/:path*",
      },
      {
        // 列表/创建路径（前端不带尾斜杠，这里精确映射回后端带斜杠的地址），
        // 避免 Next.js 去尾斜杠 + 后端补尾斜杠的双重重定向导致浏览器跨域丢失 Authorization
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
