/**
 * 路线数据模型与本地存储（后端 API 未提供，先用 localStorage mock）
 */

/** 途径站点行为 */
export interface RouteStop {
  /** auto = 停车等待固定时间后自动发车；manual = 停车等待手动发车 */
  mode: "auto" | "manual"
  /** 自动发车的等待时长（秒） */
  waitSeconds: number
}

export interface Route {
  id: number
  name: string
  /** 航点序列（用户绘制/编辑的对象，经纬度） */
  points: [number, number][]
  /** 贴路后的完整路径（高德驾车规划，经过所有航点）；无则用 points 直线连接 */
  path?: [number, number][]
  /** 途径站点（按 points 索引对齐；null/缺省 = 不停车直接通过） */
  stops?: (RouteStop | null)[]
  /** 路径生成模式：road = 高德驾车贴路；curve = 贝塞尔曲线；polyline = 直线折线 */
  mode?: "road" | "curve" | "polyline"
  /** 路线颜色（用于地图显示） */
  color?: string
}

const STORAGE_KEY = "schedule_routes"

export const ROUTE_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
]

let nextId = 1

function seed(): void {
  if (typeof window === "undefined") return
  if (localStorage.getItem(STORAGE_KEY)) return
  saveRoutes([
    {
      id: 1,
      name: "示例路线 A",
      points: [
        [114.0, 22.601],
        [114.001, 22.602],
        [114.002, 22.603],
        [114.003, 22.602],
        [114.004, 22.601],
      ],
      color: ROUTE_COLORS[0],
    },
  ])
}

/** 判断是否为合法坐标点 */
function isValidPoint(p: unknown): p is [number, number] {
  return (
    Array.isArray(p) &&
    p.length >= 2 &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1])
  )
}

export function getRoutes(): Route[] {
  if (typeof window === "undefined") return []
  try {
    seed()
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Route[]
    // 过滤非法坐标点，避免 NaN 污染地图渲染；path 也一并清理
    const sanitized = parsed
      .map((r): Route => {
        const path = Array.isArray(r.path)
          ? r.path.filter(isValidPoint)
          : undefined
        const stops = Array.isArray(r.stops)
          ? r.stops.map((s) =>
              s
                ? {
                    mode: s.mode === "manual" ? ("manual" as const) : ("auto" as const),
                    waitSeconds: Number.isFinite(s.waitSeconds)
                      ? Math.max(0, Math.round(s.waitSeconds))
                      : 30,
                  }
                : null
            )
          : undefined
        return {
          ...r,
          points: Array.isArray(r.points) ? r.points.filter(isValidPoint) : [],
          mode:
            r.mode === "curve"
              ? "curve"
              : r.mode === "polyline"
                ? "polyline"
                : "road",
          ...(path && path.length >= 2 ? { path } : { path: undefined }),
          ...(stops && stops.some((s) => s != null)
            ? { stops }
            : { stops: undefined }),
        }
      })
      .filter((r) => r.points.length >= 2)
    // 数据被污染时写回清理后的结果（自愈）
    const dirty = JSON.stringify(sanitized) !== JSON.stringify(parsed)
    if (dirty) saveRoutes(sanitized)
    nextId = sanitized.reduce((m, r) => Math.max(m, r.id), 0) + 1
    return sanitized
  } catch {
    return []
  }
}

export function saveRoutes(routes: Route[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes))
}

export function addRoute(
  name: string,
  points: [number, number][],
  path?: [number, number][],
  mode: "road" | "curve" | "polyline" = "road"
): Route {
  const routes = getRoutes()
  const route: Route = {
    id: nextId++,
    name: name || `路线 ${nextId - 1}`,
    points,
    ...(path && path.length >= 2 ? { path } : {}),
    mode,
    color: ROUTE_COLORS[(nextId - 1) % ROUTE_COLORS.length],
  }
  routes.push(route)
  saveRoutes(routes)
  return route
}

export function updateRoute(id: number, patch: Partial<Route>): void {
  const routes = getRoutes().map((r) => (r.id === id ? { ...r, ...patch } : r))
  saveRoutes(routes)
}

export function deleteRoute(id: number): void {
  saveRoutes(getRoutes().filter((r) => r.id !== id))
}

export function getRouteById(id: number): Route | undefined {
  return getRoutes().find((r) => r.id === id)
}
