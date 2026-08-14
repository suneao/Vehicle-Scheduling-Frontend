/**
 * 车辆/机器狗 → 路线 分配（后端 API 未提供，本地存储 mock）
 * 设置后虚拟车辆会沿指定路线行走
 */

import type { Route } from "@/lib/routes"
import { getRouteById } from "@/lib/routes"

const STORAGE_KEY = "route_assignments"

/** 内存缓存：避免频繁解析 localStorage */
let cache: Record<number, number> | null = null

/** 获取全部路线分配 {vehicleId: routeId} */
export function getRouteAssignments(): Record<number, number> {
  if (typeof window === "undefined") return {}
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      cache = {}
      return cache
    }
    cache = JSON.parse(raw) as Record<number, number>
    return cache
  } catch {
    cache = {}
    return cache
  }
}

/** 设置车辆路线（routeId 传 null 清除） */
export function setRouteAssignment(vehicleId: number, routeId: number | null): void {
  const all = { ...getRouteAssignments() }
  if (routeId === null) {
    delete all[vehicleId]
  } else {
    all[vehicleId] = routeId
  }
  cache = all
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

/** 获取车辆的路线 */
export function getVehicleRoute(vehicleId: number): Route | undefined {
  const routeId = getRouteAssignments()[vehicleId]
  if (!routeId) return undefined
  return getRouteById(routeId)
}

/** 生成 {vehicleId: Route} 映射（用于虚拟车辆行走） */
export function getRouteMapForVehicles(): Record<number, Route> {
  const result: Record<number, Route> = {}
  for (const [vid, rid] of Object.entries(getRouteAssignments())) {
    const route = getRouteById(rid)
    if (route) result[Number(vid)] = route
  }
  return result
}
