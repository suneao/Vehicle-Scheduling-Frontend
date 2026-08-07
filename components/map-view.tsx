"use client"

import * as React from "react"
import AMapLoader from "@amap/amap-jsapi-loader"
import { useTheme } from "next-themes"
import type { CarPosition } from "@/lib/api"
import { getMapThemeConfig } from "@/lib/map-theme"

/* ==================== 高德类型声明 ==================== */

declare global {
  interface Window {
    _AMapSecurityConfig: { securityJsCode: string }
  }
}

/** 地图实例最小类型 */
interface AMapMapInstance {
  destroy: () => void
  resize: () => void
  setFitView: (overlays: unknown[] | null, immediately: boolean, padding: number[]) => void
  setMapStyle: (style: string) => void
  addControl: (control: unknown) => void
  on: (event: string, handler: () => void) => void
}

/** 标记实例最小类型 */
interface AMapMarkerInstance {
  setMap: (map: AMapMapInstance | null) => void
}

/** AMap 命名空间最小类型 */
interface AMapNamespace {
  Map: new (container: HTMLElement, opts: Record<string, unknown>) => AMapMapInstance
  Marker: new (opts: Record<string, unknown>) => AMapMarkerInstance
  Pixel: new (x: number, y: number) => unknown
  Scale: new () => unknown
  ToolBar: new (opts: Record<string, unknown>) => unknown
}

/* ==================== 配置 ==================== */

const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY ?? ""
const AMAP_SECURITY_CODE = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE ?? ""

// 南方科技大学
const DEFAULT_CENTER: [number, number] = [114.003, 22.602]
const DEFAULT_ZOOM = 16

/**
 * 强制瓦片高清化：把瓦片 URL 的 scale=1 改为 scale=2（512px 高清瓦片）。
 * 高德仅在 DPR>=2 时请求高清瓦片，非标准缩放（如 1.25/1.333）会用到模糊的 256px 瓦片。
 */
function upgradeTileResolution(container: HTMLElement | null) {
  if (!container) return

  // 已存在的瓦片
  container.querySelectorAll<HTMLImageElement>(".amap-layer-tile img").forEach(upgradeImg)

  // 监听新瓦片插入
  const observer = new MutationObserver(() => {
    container.querySelectorAll<HTMLImageElement>(".amap-layer-tile img").forEach(upgradeImg)
  })
  observer.observe(container, { childList: true, subtree: true })

  // 存储到容器上以便清理
  ;(container as HTMLElement & { _tileObserver?: MutationObserver })._tileObserver = observer
}

/** 将单个瓦片 img 的 scale 参数提升为 2 */
function upgradeImg(img: HTMLImageElement) {
  if (img.dataset.hd === "1") return
  img.dataset.hd = "1"
  const newSrc = img.src.replace(/scale=\d+/, "scale=2")
  if (newSrc !== img.src) {
    img.src = newSrc
  }
}

/* ==================== 组件 ==================== */

interface MapViewProps {
  vehicles: CarPosition[]
}

export function MapView({ vehicles }: MapViewProps) {
  const { resolvedTheme } = useTheme()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<{ instance: AMapMapInstance; AMap: AMapNamespace } | null>(null)
  const markersRef = React.useRef<AMapMarkerInstance[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  // WebGL 是否被高德实际使用：false 时地图降级为 img 瓦片渲染，主题无法切换，强制亮色
  const [webglUsed, setWebglUsed] = React.useState<boolean | null>(null)

  const mapStyle = React.useMemo(() => {
    const cfg = getMapThemeConfig()
    // WebGL 不可用时地图固定亮色主题，忽略暗色配置
    if (webglUsed === false) return cfg.light
    return resolvedTheme === "dark" ? cfg.dark : cfg.light
  }, [resolvedTheme, webglUsed])

  // 主初始化 effect 需要初始 mapStyle，但不随主题重建地图：用 ref 传递
  const mapStyleRef = React.useRef(mapStyle)
  React.useEffect(() => {
    mapStyleRef.current = mapStyle
  }, [mapStyle])

  React.useEffect(() => {
    let cancelled = false
    // 复制容器引用，避免 cleanup 时 ref 已变化
    const container = containerRef.current

    window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE }

    AMapLoader.load({
      key: AMAP_KEY,
      version: "2.0",
      plugins: ["AMap.Scale", "AMap.ToolBar"],
    })
      .then((AMap: AMapNamespace) => {
        if (cancelled || !container) return

        const map = new AMap.Map(container, {
          // WebGL 渲染：纹理线性过滤比 img 瓦片放大更平滑，缓解高分屏模糊
          viewMode: "3D",
          pitch: 0,
          zoom: DEFAULT_ZOOM,
          center: DEFAULT_CENTER,
          mapStyle: mapStyleRef.current,
          resizeEnable: true,
          devicePixelRatio: 2,
        })

        map.addControl(new AMap.Scale())
        map.addControl(new AMap.ToolBar({ position: "RT" }))

        // 容器尺寸稳定后强制重算，确保按真实尺寸渲染
        map.on("complete", () => {
          map.resize()
          upgradeTileResolution(container)
          // 检测高德是否实际使用 WebGL 渲染（WebGL 渲染会创建 canvas，img 瓦片降级则无 canvas）
          setWebglUsed(container.querySelectorAll("canvas").length > 0)
        })

        mapRef.current = { instance: map, AMap }
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      ;(container as HTMLElement & { _tileObserver?: MutationObserver } | null)?._tileObserver?.disconnect()
      mapRef.current?.instance?.destroy()
      mapRef.current = null
    }
  }, [])

  // 容器尺寸变化时重算地图渲染（flex 布局调整后保持高清）
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      mapRef.current?.instance?.resize()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 主题切换时更新地图样式
  React.useEffect(() => {
    mapRef.current?.instance?.setMapStyle(mapStyle)
  }, [mapStyle])
  React.useEffect(() => {
    const entry = mapRef.current
    if (!entry) return

    const { instance: map, AMap } = entry

    for (const m of markersRef.current) {
      m.setMap(null)
    }
    markersRef.current = []

    if (vehicles.length === 0) return

    const markers: AMapMarkerInstance[] = []

    for (const v of vehicles) {
      const alive = v.speed > 0
      const hasAngle = v.angle != null

      const el = document.createElement("div")
      el.style.cssText = "display:flex;flex-direction:column;align-items:center;"
      // WebGL 不可用时地图降级为亮色渲染，marker 固定用亮色主题主色（近黑，非黄色）以保证可见
      const dropColor =
        webglUsed === false ? "#212121" : "var(--color-primary,#f59e0b)"
      el.innerHTML = `
        <svg width="16" height="20" viewBox="-2 -2 20 25" style="
          overflow:visible;
          transform:${hasAngle ? `rotate(${v.angle}deg)` : "none"};
          transform-box:fill-box;
          filter:drop-shadow(0 1px 2px rgba(0,0,0,0.25));
        ">
          <path d="M8 1 C 12 6.5 15 10 15 13 A 7 7 0 1 1 1 13 C 1 10 4 6.5 8 1 Z"
            fill="${dropColor}" stroke="#fff" stroke-width="1.5"
            opacity="${alive ? 1 : 0.6}" />
          <circle cx="8" cy="13" r="3.5" fill="none" stroke="#fff" stroke-width="1.5" />
        </svg>
        <span style="
          margin-top:3px;font-size:10px;font-weight:600;
          font-family:monospace;color:#333;
          background:rgba(255,255,255,0.9);
          padding:1px 4px;border-radius:2px;
          white-space:nowrap;
        ">#${v.car_id}</span>
      `

      const marker = new AMap.Marker({
        position: [v.x, v.y] as [number, number],
        content: el,
        offset: new AMap.Pixel(0, -18),
        zIndex: alive ? 200 : 100,
      })
      marker.setMap(map)
      markers.push(marker)
    }

    markersRef.current = markers
    map.setFitView(null, false, [80, 80, 80, 80])
  }, [vehicles])

  return (
    // 绝对定位填满父级（父级需 relative），避免 flex 中 height:100% 解析为 0 导致渲染模糊
    <div className="absolute inset-0">
      <div ref={containerRef} className="size-full" />
      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/50">
          <p className="text-xs text-muted-foreground/40">地图加载中…</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="max-w-xs text-center text-xs text-muted-foreground/40">
            地图加载失败: {error}
          </p>
        </div>
      )}
    </div>
  )
}
