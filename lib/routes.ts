/**
 * 路线数据模型与云端存取（对齐后端 /admin/paths、/admin/sites、/admin/waypoints）
 * 后端将路线拆分为：路线(path，含 name/type/有序节点引用) + 站点(site) + 途经点(waypoint)。
 * 本模块负责在前端 Route 模型与后端三表之间做转换，并缓存到内存（不再使用 localStorage）。
 */

import {
  pathsList,
  pathsCreate,
  pathsUpdate,
  pathsDelete,
  sitesList,
  sitesCreate,
  sitesUpdate,
  waypointsList,
  waypointsCreate,
  waypointsUpdate,
  type PathRecord,
  type PathNodeRef,
  type SiteRecord,
  type WaypointRecord,
} from "@/lib/api"

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
  /** 贴路后的完整路径（高德驾车规划）；后端不保存，仅当前会话缓存 */
  path?: [number, number][]
  /** 途径站点（按 points 索引对齐；null/缺省 = 不停车直接通过） */
  stops?: (RouteStop | null)[]
  /** 路径生成模式：road = 高德驾车贴路；curve = 贝塞尔曲线；polyline = 直线折线 */
  mode?: "road" | "curve" | "polyline"
  /** 路线颜色（由 id 确定性派生，不依赖本地存储） */
  color?: string
  /** 后端节点引用（内部使用，用于更新时复用站点/途经点 id） */
  nodeChain?: PathNodeRef[]
}

export const ROUTE_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
]

/** 内存缓存：云端加载后缓存，避免反复请求 */
let cache: Route[] | null = null

/** path_type 与前端 mode 互转 */
function normalizeMode(t: string | undefined): "road" | "curve" | "polyline" {
  return t === "curve" ? "curve" : t === "polyline" ? "polyline" : "road"
}

/** 由 id 确定性派生颜色，保证同一条路线颜色稳定且无需本地存储 */
function colorForId(id: number): string {
  const idx = ((id - 1) % ROUTE_COLORS.length + ROUTE_COLORS.length) % ROUTE_COLORS.length
  return ROUTE_COLORS[idx]
}

function isValidPoint(p: unknown): p is [number, number] {
  return (
    Array.isArray(p) &&
    p.length >= 2 &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1])
  )
}

/** 将后端 Path 记录（结合站点/途经点坐标）还原为前端 Route */
function buildRoute(
  path: PathRecord,
  sites: Map<number, SiteRecord>,
  waypoints: Map<number, WaypointRecord>
): Route | null {
  const points: [number, number][] = []
  const stops: (RouteStop | null)[] = []
  const nodeChain: PathNodeRef[] = []

  for (const node of path.node_chain ?? []) {
    if (!node || typeof node !== "object" || !node.id) continue
    if (node.type === "site") {
      const s = sites.get(node.id)
      if (!s || !Number.isFinite(s.lon) || !Number.isFinite(s.lat)) continue
      points.push([s.lon, s.lat])
      stops.push({
        mode: "auto",
        waitSeconds:
          Number.isFinite(s.dwell_time) && (s.dwell_time ?? 0) > 0
            ? Math.max(0, Math.round(s.dwell_time as number))
            : 0,
      })
      nodeChain.push({ type: "site", id: node.id })
    } else if (node.type === "waypoint") {
      const w = waypoints.get(node.id)
      if (!w || !Number.isFinite(w.lon) || !Number.isFinite(w.lat)) continue
      points.push([w.lon, w.lat])
      stops.push(null)
      nodeChain.push({ type: "waypoint", id: node.id })
    }
  }

  if (points.length < 2) return null

  return {
    id: path.id,
    name: path.name,
    points,
    mode: normalizeMode(path.path_type),
    color: colorForId(path.id),
    ...(stops.some((s) => s != null) ? { stops } : {}),
    nodeChain,
  }
}

/** 同步读取内存缓存（云端加载前返回空数组） */
export function getRoutes(): Route[] {
  return cache ?? []
}

/** 从云端加载全部路线并更新缓存 */
export async function loadRoutes(): Promise<Route[]> {
  try {
    const [pathsRes, sitesRes, waypointsRes] = await Promise.all([
      pathsList(),
      sitesList(),
      waypointsList(),
    ])
    const sites = new Map((sitesRes.data ?? []).map((s) => [s.id, s]))
    const waypoints = new Map((waypointsRes.data ?? []).map((w) => [w.id, w]))
    const routes = (pathsRes.data ?? [])
      .map((p) => buildRoute(p, sites, waypoints))
      .filter((r): r is Route => r != null)
      .sort((a, b) => a.id - b.id)
    cache = routes
    return routes
  } catch {
    // 云端不可用时返回空列表（页面显示「暂无路线」）
    cache = []
    return []
  }
}

export function getRouteById(id: number): Route | undefined {
  return getRoutes().find((r) => r.id === id)
}

/** 把前端 stops 数组转为后端节点链（创建站点/途经点并返回引用） */
async function persistNodes(
  points: [number, number][],
  stops: (RouteStop | null)[] | undefined,
  oldChain: PathNodeRef[] | undefined
): Promise<PathNodeRef[]> {
  const nodeChain: PathNodeRef[] = []
  for (let i = 0; i < points.length; i++) {
    const [lon, lat] = points[i]
    const stop = stops?.[i] ?? null
    const wantType: "site" | "waypoint" = stop ? "site" : "waypoint"
    const old = oldChain?.[i]

    if (old && old.type === wantType) {
      // 类型未变：原地更新，避免产生孤儿节点
      if (stop) {
        await sitesUpdate(old.id, {
          name: `站点 ${i + 1}`,
          lon,
          lat,
          dwell_time: Math.max(0, Math.round(stop.waitSeconds)),
        })
      } else {
        await waypointsUpdate(old.id, { name: `途经点 ${i + 1}`, lon, lat })
      }
      nodeChain.push(old)
    } else {
      // 新增或类型变更：创建新节点（旧节点不再被引用，不做删除以免影响其他路线）
      if (stop) {
        const res = await sitesCreate({
          name: `站点 ${i + 1}`,
          lon,
          lat,
          dwell_time: Math.max(0, Math.round(stop.waitSeconds)),
        })
        nodeChain.push({ type: "site", id: res.data.id })
      } else {
        const res = await waypointsCreate({ name: `途经点 ${i + 1}`, lon, lat })
        nodeChain.push({ type: "waypoint", id: res.data.id })
      }
    }
  }
  return nodeChain
}

/** 新增路线（云端） */
export async function addRoute(
  name: string,
  points: [number, number][],
  path?: [number, number][],
  mode: "road" | "curve" | "polyline" = "road",
  stops?: (RouteStop | null)[]
): Promise<Route> {
  const clean = points.filter(isValidPoint)
  const nodeChain = await persistNodes(clean, stops, undefined)
  const res = await pathsCreate({
    name: name || "未命名路线",
    path_type: mode,
    node_chain: nodeChain,
  })
  const record = res.data
  const route: Route = {
    id: record.id,
    name: record.name,
    points: clean,
    mode,
    color: colorForId(record.id),
    ...(path && path.length >= 2 ? { path } : {}),
    ...(stops && stops.some((s) => s != null) ? { stops } : {}),
    nodeChain,
  }
  cache = [...(cache ?? []), route]
  return route
}

/** 更新路线（云端） */
export async function updateRoute(id: number, patch: Partial<Route>): Promise<void> {
  const existing = getRoutes().find((r) => r.id === id)
  if (!existing) throw new Error("路线不存在")

  const points = (patch.points ?? existing.points).filter(isValidPoint)
  const stops = patch.stops ?? existing.stops
  const mode = patch.mode ?? existing.mode ?? "road"
  const name = (patch.name ?? existing.name).trim() || existing.name

  const nodeChain = await persistNodes(points, stops, existing.nodeChain)

  await pathsUpdate(id, { name, path_type: mode, node_chain: nodeChain })

  const cleanPath = patch.path && patch.path.length >= 2 ? patch.path : undefined
  cache = (cache ?? []).map((r) =>
    r.id === id
      ? {
          ...r,
          name,
          points,
          mode,
          ...(stops && stops.some((s) => s != null) ? { stops } : { stops: undefined }),
          ...(cleanPath ? { path: cleanPath } : { path: undefined }),
          nodeChain,
        }
      : r
  )
}

/** 删除路线（云端；站点/途经点因后端无级联删除而保留） */
export async function deleteRoute(id: number): Promise<void> {
  await pathsDelete(id)
  cache = (cache ?? []).filter((r) => r.id !== id)
}
