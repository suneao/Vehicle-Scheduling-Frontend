/**
 * 电量等级与对应颜色（侧边栏圆点 / 地图标记共用）
 */

export type BatteryLevel = "normal" | "warning" | "critical"

/** 电量等级：normal 正常；warning 偏低(≤50)；critical 严重偏低(≤20) */
export function getBatteryLevel(battery: number | undefined): BatteryLevel {
  if (battery == null) return "normal"
  if (battery <= 20) return "critical"
  if (battery <= 50) return "warning"
  return "normal"
}

/** 侧边栏状态圆点颜色（bg + ring 色） */
export function batteryDotClass(
  battery: number | undefined,
  alive: boolean
): string {
  switch (getBatteryLevel(battery)) {
    case "critical":
      return "bg-red-500 ring-red-500/30"
    case "warning":
      return "bg-amber-400 ring-amber-400/30"
    default:
      return alive
        ? "bg-primary ring-primary/30"
        : "bg-muted-foreground/30 ring-transparent"
  }
}

/** 侧边栏状态圆点发光（boxShadow） */
export function batteryDotGlow(
  battery: number | undefined,
  alive: boolean
): string | undefined {
  switch (getBatteryLevel(battery)) {
    case "critical":
      return "0 0 8px rgba(239,68,68,0.6)"
    case "warning":
      return "0 0 8px rgba(245,158,11,0.6)"
    default:
      return alive ? "0 0 8px var(--color-primary)" : undefined
  }
}

/** 地图标记颜色（hex）；normal 返回 undefined 表示沿用默认色 */
export function batteryMarkerColor(
  battery: number | undefined
): string | undefined {
  switch (getBatteryLevel(battery)) {
    case "critical":
      return "#ef4444"
    case "warning":
      return "#f59e0b"
    default:
      return undefined
  }
}
