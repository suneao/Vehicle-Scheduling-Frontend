import type { NextConfig } from "next"

// 后端地址：部署时可通过环境变量 BACKEND_URL 覆盖（默认指向当前开发后端）
const BACKEND = process.env.BACKEND_URL ?? "http://39.108.77.178:8001"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND}/api/:path*`,
      },
      {
        // 列表/创建路径（前端不带尾斜杠，这里精确映射回后端带斜杠的地址），
        // 避免 Next.js 去尾斜杠 + 后端补尾斜杠的双重重定向导致浏览器跨域丢失 Authorization
        source: "/admin/maps",
        destination: `${BACKEND}/admin/maps/`,
      },
      {
        source: "/admin/paths",
        destination: `${BACKEND}/admin/paths/`,
      },
      {
        source: "/admin/sites",
        destination: `${BACKEND}/admin/sites/`,
      },
      {
        source: "/admin/waypoints",
        destination: `${BACKEND}/admin/waypoints/`,
      },
      {
        // 详情/更新/删除路径（如 /admin/paths/1）：原样转发，不带尾斜杠
        source: "/admin/:path*",
        destination: `${BACKEND}/admin/:path*`,
      },
      {
        source: "/report/:path*",
        destination: `${BACKEND}/report/:path*`,
      },
    ]
  },
}

export default nextConfig
