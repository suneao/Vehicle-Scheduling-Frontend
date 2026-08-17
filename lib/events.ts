/**
 * 事件数据模型与本地存储（后端 API 未提供，先用 localStorage mock）
 * 事件 = 指定时间在指定路线上控制某车辆开启/关闭，带优先级（数字越大越优先）
 */

export interface ScheduleEvent {
  id: number
  /** 事件名称 */
  name: string
  /** 执行时间（HH:mm） */
  time: string
  /** 关联路线 id */
  route_id: number
  /** 关联车辆/机器狗 id */
  vehicle_id: number
  /** 车辆控制动作 */
  action: "on" | "off"
  /** 优先级（数字越大越优先执行） */
  priority: number
}

const STORAGE_KEY = "schedule_events"

let nextId = 1
/** 内存缓存：避免频繁解析 localStorage */
let cache: ScheduleEvent[] | null = null

function seed(): void {
  if (typeof window === "undefined") return
  if (localStorage.getItem(STORAGE_KEY)) return
  saveEvents([
    {
      id: 1,
      name: "车辆 1 早晨巡检",
      time: "08:00",
      route_id: 1,
      vehicle_id: 1,
      action: "on",
      priority: 3,
    },
  ])
}

export function getEvents(): ScheduleEvent[] {
  if (typeof window === "undefined") return []
  if (cache) return cache
  try {
    seed()
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      cache = []
      return cache
    }
    const events = JSON.parse(raw) as ScheduleEvent[]
    nextId = events.reduce((m, e) => Math.max(m, e.id), 0) + 1
    cache = events
    return events
  } catch {
    cache = []
    return cache
  }
}

export function saveEvents(events: ScheduleEvent[]): void {
  cache = events
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
}

export function addEvent(event: Omit<ScheduleEvent, "id">): ScheduleEvent {
  const events = [...getEvents()]
  const item: ScheduleEvent = { ...event, id: nextId++ }
  events.push(item)
  saveEvents(events)
  return item
}

export function updateEvent(id: number, patch: Partial<ScheduleEvent>): void {
  const events = getEvents().map((e) => (e.id === id ? { ...e, ...patch } : e))
  saveEvents(events)
}

export function deleteEvent(id: number): void {
  saveEvents(getEvents().filter((e) => e.id !== id))
}

/** 按优先级排序（数字越大越优先） */
export function getEventsByPriority(): ScheduleEvent[] {
  return [...getEvents()].sort((a, b) => b.priority - a.priority)
}

/** 某车辆的事件表（按优先级排序） */
export function getVehicleEvents(vehicleId: number): ScheduleEvent[] {
  return getEventsByPriority().filter((e) => e.vehicle_id === vehicleId)
}

/** 事件是否引用某路线 */
export function eventUsesRoute(routeId: number): boolean {
  return getEvents().some((e) => e.route_id === routeId)
}
