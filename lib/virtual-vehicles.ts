/**
 * 虚拟小车数据生成器
 * 用于前端测试：无真实 ROS 车辆接入时，模拟多辆小车在南方科技大学附近移动。
 * 支持两种移动模式：默认椭圆巡逻轨迹 / 按指定路线行走。
 */

import type { CarPosition } from "@/lib/api"
import type { Route } from "@/lib/routes"

/** 虚拟小车开关：true 时真实数据为空会注入虚拟车辆 */
export const VIRTUAL_VEHICLES_ENABLED = true

/** 1 经度/纬度 ≈ 111 km（用于把角速度换算为 m/s） */
const DEG_TO_M = 111000

/** 按路线行走时的速度（m/s） */
const ROUTE_SPEED_MPS = 4

/** 虚拟车辆配置：默认椭圆轨迹 */
interface VirtualVehicleConfig {
  car_id: number
  cx: number
  cy: number
  radius: number
  speed: number
  phase: number
}

const VIRTUAL_VEHICLES: VirtualVehicleConfig[] = [
  { car_id: 1, cx: 113.9992, cy: 22.6004, radius: 0.0032, speed: 0.0225, phase: 0.0 },
  { car_id: 2, cx: 114.0048, cy: 22.6042, radius: 0.0024, speed: 0.03, phase: 1.4 },
  { car_id: 3, cx: 114.0015, cy: 22.5986, radius: 0.0041, speed: 0.0176, phase: 2.6 },
  { car_id: 4, cx: 114.0066, cy: 22.6018, radius: 0.0026, speed: 0.0277, phase: 4.0 },
]

/** 两点欧氏距离（经纬度） */
function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

/** 已通过“继续/发车”释放手动站点等待的车辆 */
const releasedStops = new Set<number>()

/** 释放某车辆的手动站点等待（继续发车） */
export function releaseVehicleStops(carId: number): void {
  releasedStops.add(carId)
}

interface StopInfo {
  /** 站点在路径上的累计距离 */
  arrivalDist: number
  mode: "auto" | "manual"
  waitSeconds: number
}

/**
 * 沿路线插值移动（按时间循环行走，速度恒定，途经站点停车）
 * - 自动站点：停车等待 waitSeconds 后自动发车
 * - 手动站点：停车等待人工发车（releaseVehicleStops 释放）
 */
function moveAlongRoute(
  route: Route,
  t: number,
  carId: number
): CarPosition {
  // 贴路路径优先（高德驾车规划），无则沿航点直线行走
  const points = route.path && route.path.length >= 2 ? route.path : route.points
  const last = points[points.length - 1]
  if (points.length < 2) {
    return {
      car_id: carId,
      x: last[0],
      y: last[1],
      speed: 0,
      angle: 0,
      update_time: new Date().toISOString(),
    }
  }

  // 计算各段长度与累计距离
  const segments: number[] = []
  const cum: number[] = [0]
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const d = dist(points[i], points[i + 1])
    segments.push(d)
    total += d
    cum.push(total)
  }

  // 退化路线（所有点重合）：停在起点
  if (total === 0) {
    return {
      car_id: carId,
      x: points[0][0],
      y: points[0][1],
      speed: 0,
      angle: 0,
      update_time: new Date().toISOString(),
    }
  }

  const speed = ROUTE_SPEED_MPS / DEG_TO_M // 度/秒
  const released = releasedStops.has(carId)

  // 站点 → 路径上的累计距离（航点落在路径上的最近点）
  const stops: StopInfo[] = []
  const rawStops = Array.isArray(route.stops) ? route.stops : []
  for (let i = 0; i < rawStops.length; i++) {
    const s = rawStops[i]
    const wp = route.points[i]
    if (!s || !wp) continue
    let best = 0
    let bestD = Infinity
    for (let j = 0; j < points.length; j++) {
      const dx = points[j][0] - wp[0]
      const dy = points[j][1] - wp[1]
      const d2 = dx * dx + dy * dy
      if (d2 < bestD) {
        bestD = d2
        best = j
      }
    }
    stops.push({
      arrivalDist: cum[best],
      mode: s.mode,
      waitSeconds: Math.max(0, s.waitSeconds || 0),
    })
  }
  stops.sort((a, b) => a.arrivalDist - b.arrivalDist)

  /** 路径上某距离处的位置与朝向 */
  const posAt = (dist: number) => {
    let acc = 0
    for (let i = 0; i < segments.length; i++) {
      if (acc + segments[i] >= dist) {
        const frac = segments[i] === 0 ? 0 : (dist - acc) / segments[i]
        const [x1, y1] = points[i]
        const [x2, y2] = points[i + 1]
        return {
          x: x1 + (x2 - x1) * frac,
          y: y1 + (y2 - y1) * frac,
          angle: Number(((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI).toFixed(1)),
        }
      }
      acc += segments[i]
    }
    return { x: last[0], y: last[1], angle: 0 }
  }

  // 按时间推进：行驶 + 站点等待（循环多圈）
  let remaining = t
  for (;;) {
    let walked = 0
    for (const st of stops) {
      const at = st.arrivalDist / speed // 到本站的累计行驶时间
      const need = at - walked
      if (remaining >= need) {
        remaining -= need
        walked = at
        const wait =
          st.mode === "auto" ? st.waitSeconds : released ? 0 : Infinity
        if (remaining < wait) {
          // 正在本站等待
          const p = posAt(st.arrivalDist)
          return {
            car_id: carId,
            x: p.x,
            y: p.y,
            speed: 0,
            angle: p.angle,
            update_time: new Date().toISOString(),
          }
        }
        remaining -= wait
      } else {
        // 行驶中（未到下一站）
        const p = posAt((walked + remaining) * speed)
        return {
          car_id: carId,
          x: p.x,
          y: p.y,
          speed: Number(ROUTE_SPEED_MPS.toFixed(2)),
          angle: p.angle,
          update_time: new Date().toISOString(),
        }
      }
    }
    // 走完一圈回到起点
    const lapRemain = total / speed - walked
    if (remaining <= lapRemain) {
      const p = posAt((walked + remaining) * speed)
      return {
        car_id: carId,
        x: p.x,
        y: p.y,
        speed: Number(ROUTE_SPEED_MPS.toFixed(2)),
        angle: p.angle,
        update_time: new Date().toISOString(),
      }
    }
    remaining -= lapRemain
    // 进入下一圈
  }
}

/** 默认椭圆轨迹 */
function moveEllipse(v: VirtualVehicleConfig, t: number): CarPosition {
  const { car_id, cx, cy, radius, speed, phase } = v
  const x = cx + Math.cos(t * speed + phase) * radius
  const y = cy + Math.sin(t * speed + phase) * radius * 0.85
  const vx = -Math.sin(t * speed + phase) * speed * radius
  const vy = Math.cos(t * speed + phase) * speed * radius * 0.85
  const speedMps = Math.hypot(vx, vy) * DEG_TO_M
  const angle = (Math.atan2(vy, vx) * 180) / Math.PI

  return {
    car_id,
    x,
    y,
    speed: Number(speedMps.toFixed(2)),
    angle: Number(angle.toFixed(1)),
    update_time: new Date().toISOString(),
  }
}

/**
 * 生成当前时刻的虚拟车辆位置
 * @param routeMap 车辆 → 路线映射；有路线的车辆沿路线行走，其余走椭圆轨迹
 */
export function getVirtualCarPositions(
  routeMap?: Record<number, Route>
): Record<string, CarPosition> {
  const t = Date.now() / 1000
  const result: Record<string, CarPosition> = {}

  for (const v of VIRTUAL_VEHICLES) {
    const route = routeMap?.[v.car_id]
    result[String(v.car_id)] = route
      ? moveAlongRoute(route, t, v.car_id)
      : moveEllipse(v, t)
  }

  return result
}
