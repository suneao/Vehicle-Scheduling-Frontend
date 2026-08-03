"use client"

import * as React from "react"
import AMapLoader from "@amap/amap-jsapi-loader"
import type { CarPosition } from "@/lib/api"

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
  const containerRef = React.useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = React.useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = React.useRef<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    // 安全密钥必须在加载前设置
    window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE }

    AMapLoader.load({
      key: AMAP_KEY,
      version: "2.0",
    })
      .then((AMap) => {
        if (cancelled || !containerRef.current) return

        const map = new AMap.Map(containerRef.current, {
          viewMode: "2D",
          zoom: DEFAULT_ZOOM,
          center: DEFAULT_CENTER,
          resizeEnable: true,
        })

        map.addControl(new AMap.Scale())
        map.addControl(new AMap.ToolBar({ position: "RT" }))

        mapRef.current = { instance: map, AMap }
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          setError(msg)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      mapRef.current?.instance?.destroy()
      mapRef.current = null
    }
  }, [])

  // 更新车辆标记
  React.useEffect(() => {
    const entry = mapRef.current
    if (!entry) return

    const { instance: map, AMap } = entry

    // 清除旧标记
    for (const m of markersRef.current) {
      m.setMap(null)
    }
    markersRef.current = []

    if (vehicles.length === 0) return

    const markers: any[] = []

    for (const v of vehicles) {
      const alive = v.speed > 0

      // 用 DOM 创建自定义标记
      const el = document.createElement("div")
      el.style.cssText = "display:flex;flex-direction:column;align-items:center;"
      el.innerHTML = `
        <div style="
          width:10px;height:10px;border-radius:50%;
          background:var(--color-primary,#f59e0b);
          box-shadow:${alive ? "0 0 10px var(--color-primary,#f59e0b)" : "none"};
          border:2px solid #fff;
          opacity:${alive ? 1 : 0.5};
        "></div>
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

    // 适配视野
    map.setFitView(null, false, [80, 80, 80, 80])
  }, [vehicles])

  if (error) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="max-w-xs text-center text-xs text-muted-foreground/40">
          地图加载失败: {error}
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-xs text-muted-foreground/40">地图加载中…</p>
      </div>
    )
  }

  return <div ref={containerRef} className="size-full" />
}
