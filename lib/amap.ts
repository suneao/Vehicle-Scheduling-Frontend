/**
 * 高德地图共享层：类型声明、配置常量、加载与主题/WebGL 工具。
 * 三个地图组件（map-view / schedule-map / route-map）共用，避免重复。
 */

import AMapLoader from "@amap/amap-jsapi-loader"
import { getMapThemeConfig } from "@/lib/map-theme"

/* ==================== 全局安全密钥 ==================== */

declare global {
  interface Window {
    _AMapSecurityConfig: { securityJsCode: string }
  }
}

/* ==================== 最小类型声明 ==================== */

export interface AMapMapInstance {
  destroy: () => void
  resize: () => void
  setFitView: (overlays: unknown[] | null, immediately: boolean, padding: number[]) => void
  setMapStyle: (style: string) => void
  addControl: (control: unknown) => void
  on: (event: string, handler: (...args: unknown[]) => void) => void
  getZoom: () => number
  setZoom: (zoom: number) => void
  setCenter: (center: [number, number]) => void
  setRotation: (deg: number, immediate?: boolean) => void
  setPitch: (pitch: number) => void
}

export interface AMapMarkerInstance {
  setMap: (map: AMapMapInstance | null) => void
  on: (event: string, handler: (...args: unknown[]) => void) => void
  getPosition: () => { getLng(): number; getLat(): number } | null
  setPosition: (position: [number, number]) => void
}

export interface AMapPolylineInstance {
  setMap: (map: AMapMapInstance | null) => void
  on: (event: string, handler: (...args: unknown[]) => void) => void
  setPath: (path: [number, number][]) => void
  setOptions: (opts: Record<string, unknown>) => void
}

export interface AMapNamespace {
  Map: new (container: HTMLElement, opts: Record<string, unknown>) => AMapMapInstance
  Marker: new (opts: Record<string, unknown>) => AMapMarkerInstance
  Polyline: new (opts: Record<string, unknown>) => AMapPolylineInstance
  Pixel: new (x: number, y: number) => unknown
  Scale: new () => unknown
  ToolBar: new (opts: Record<string, unknown>) => unknown
  Driving: new (opts: Record<string, unknown>) => {
    search: {
      (
        origin: [number, number],
        dest: [number, number],
        callback: (status: string, result: DrivingResult) => void
      ): void
      (
        origin: [number, number],
        dest: [number, number],
        options: { waypoints: [number, number][] },
        callback: (status: string, result: DrivingResult) => void
      ): void
    }
  }
  plugin: (name: string, callback: () => void) => void
}

/** 地图覆盖物（标记/折线）最小类型 */
export interface MapOverlay {
  setMap: (map: AMapMapInstance | null) => void
}

/** 驾车规划结果中的坐标（LngLat 或 [lng, lat]） */
export type AmapLngLat = [number, number] | { getLng(): number; getLat(): number }

/** 驾车规划返回结构 */
export interface DrivingResult {
  routes?: Array<{ steps?: Array<{ path?: AmapLngLat[] }> }>
}

/** 地图实例 + AMap 命名空间 */
export interface MapEntry {
  instance: AMapMapInstance
  AMap: AMapNamespace
}

/* ==================== 配置常量 ==================== */

export const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY ?? ""
export const AMAP_SECURITY_CODE = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE ?? ""

// 南方科技大学
export const DEFAULT_CENTER: [number, number] = [114.003, 22.602]
export const DEFAULT_ZOOM = 16

/* ==================== 工具函数 ==================== */

/** 设置高德安全密钥（加载前调用） */
export function setAmapSecurity(): void {
  if (typeof window === "undefined") return
  window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE }
}

/** 加载高德 JS API（返回 AMap 命名空间） */
export function loadAmap(plugins: string[]): Promise<AMapNamespace> {
  setAmapSecurity()
  return AMapLoader.load({
    key: AMAP_KEY,
    version: "2.0",
    plugins,
  }) as Promise<AMapNamespace>
}

/** 创建标准地图实例：3D 渲染 + 2D 俯视，提升高清清晰度 */
export function createAmapMap(
  AMap: AMapNamespace,
  container: HTMLElement,
  mapStyle: string
): AMapMapInstance {
  return new AMap.Map(container, {
    viewMode: "3D",
    pitch: 0,
    rotation: 0,
    zoom: DEFAULT_ZOOM,
    center: DEFAULT_CENTER,
    mapStyle,
    resizeEnable: true,
    devicePixelRatio: 2,
  })
}

/** 根据主题与 WebGL 可用性解析地图样式 */
export function resolveMapStyle(
  resolvedTheme: string | undefined,
  webglUsed: boolean | null
): string {
  const cfg = getMapThemeConfig()
  // WebGL 不可用时地图固定亮色主题，忽略暗色配置
  if (webglUsed === false) return cfg.light
  return resolvedTheme === "dark" ? cfg.dark : cfg.light
}

/** 检测高德是否实际使用 WebGL（WebGL 会创建 canvas，img 瓦片降级则无 canvas） */
export function detectWebglUsed(container: HTMLElement | null): boolean {
  return (container?.querySelectorAll("canvas").length ?? 0) > 0
}
