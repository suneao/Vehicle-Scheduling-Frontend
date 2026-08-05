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

/* ==================== 配置 ==================== */

const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY ?? ""
const AMAP_SECURITY_CODE = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE ?? ""

// 南方科技大学
const DEFAULT_CENTER: [number, number] = [114.003, 22.602]
const DEFAULT_ZOOM = 16

/* ==================== 组件 ==================== */

interface MapViewProps {
  vehicles: CarPosition[]
}

export function MapView({ vehicles }: MapViewProps) {
  const { resolvedTheme } = useTheme()
  const containerRef = React.useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = React.useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = React.useRef<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const mapStyle = React.useMemo(() => {
    const cfg = getMapThemeConfig()
    return resolvedTheme === "dark" ? cfg.dark : cfg.light
  }, [resolvedTheme])

  React.useEffect(() => {
    let cancelled = false

    window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE }

    AMapLoader.load({
      key: AMAP_KEY,
      version: "2.0",
      plugins: ["AMap.Scale", "AMap.ToolBar"],
    })
      .then((AMap) => {
        if (cancelled || !containerRef.current) return

        const map = new AMap.Map(containerRef.current, {
          viewMode: "2D",
          zoom: DEFAULT_ZOOM,
          center: DEFAULT_CENTER,
          mapStyle,
          resizeEnable: true,
        })

        map.addControl(new AMap.Scale())
        map.addControl(new AMap.ToolBar({ position: "RT" }))

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
      mapRef.current?.instance?.destroy()
      mapRef.current = null
    }
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

    const markers: any[] = []

    for (const v of vehicles) {
      const alive = v.speed > 0
      const hasAngle = v.angle != null

      const el = document.createElement("div")
      el.style.cssText = "display:flex;flex-direction:column;align-items:center;"
      el.innerHTML = `
        <div style="position:relative;">
          <div style="
            width:10px;height:10px;border-radius:50%;
            background:var(--color-primary,#f59e0b);
            box-shadow:${alive ? "0 0 10px var(--color-primary,#f59e0b)" : "none"};
            border:2px solid #fff;
            opacity:${alive ? 1 : 0.5};
          "></div>
          ${hasAngle ? `
          <div style="
            position:absolute;top:50%;left:50%;
            width:0;height:0;margin-left:-3px;margin-top:-13px;
            border-left:3px solid transparent;
            border-right:3px solid transparent;
            border-bottom:8px solid var(--color-primary,#f59e0b);
            transform:rotate(${v.angle}deg);
            transform-origin:3px 11px;
          "></div>` : ""}
        </div>
        <span style="
          margin-top:2px;font-size:10px;font-weight:600;
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
    <div className="relative size-full">
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
