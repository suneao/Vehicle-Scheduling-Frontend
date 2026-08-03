"use client"

import * as React from "react"
import AMapLoader from "@amap/amap-jsapi-loader"
import { useTheme } from "next-themes"
import type { CarPosition } from "@/lib/api"

const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY ?? ""
const AMAP_SECURITY_CODE = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE ?? ""

const DEFAULT_CENTER: [number, number] = [114.003, 22.602]
const DEFAULT_ZOOM = 16

interface ScheduleMapProps {
  vehicles: CarPosition[]
  onSelect: (vehicle: CarPosition) => void
  selectedId?: number
}

export function ScheduleMap({ vehicles, onSelect, selectedId }: ScheduleMapProps) {
  const { resolvedTheme } = useTheme()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<any>(null)
  const markersRef = React.useRef<any[]>([])
  const onSelectRef = React.useRef(onSelect)
  onSelectRef.current = onSelect
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const mapStyle =
    resolvedTheme === "dark" ? "amap://styles/dark" : "amap://styles/macaron"

  // 初始化地图
  React.useEffect(() => {
    let cancelled = false
    window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE }

    AMapLoader.load({ key: AMAP_KEY, version: "2.0", plugins: ["AMap.Scale"] })
      .then((AMap) => {
        if (cancelled || !containerRef.current) return

        const map = new AMap.Map(containerRef.current, {
          viewMode: "2D", zoom: DEFAULT_ZOOM,
          center: DEFAULT_CENTER, mapStyle, resizeEnable: true,
        })
        map.addControl(new AMap.Scale())
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

  // 主题切换
  React.useEffect(() => {
    mapRef.current?.instance?.setMapStyle(mapStyle)
  }, [mapStyle])

  // 更新车辆标记
  React.useEffect(() => {
    const entry = mapRef.current
    if (!entry) return
    const { instance: map, AMap } = entry

    for (const m of markersRef.current) m.setMap(null)
    markersRef.current = []

    if (vehicles.length === 0) return

    const markers: any[] = []

    for (const v of vehicles) {
      const alive = v.speed > 0
      const hasAngle = v.angle != null
      const isSelected = v.car_id === selectedId
      const color = isSelected ? "#22c55e" : "var(--color-primary,#f59e0b)"

      const el = document.createElement("div")
      el.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;"
      el.innerHTML = `
        <div style="position:relative;">
          <div style="
            width:${isSelected ? 16 : 12}px;height:${isSelected ? 16 : 12}px;
            border-radius:50%;background:${color};
            box-shadow:0 0 ${isSelected ? 16 : 10}px ${color};
            border:${isSelected ? 3 : 2}px solid #fff;
            opacity:${alive || isSelected ? 1 : 0.5};
            transition:all 0.2s;
          "></div>
          ${hasAngle ? `
          <div style="
            position:absolute;top:50%;left:50%;
            width:0;height:0;margin-left:-4px;margin-top:-15px;
            border-left:4px solid transparent;
            border-right:4px solid transparent;
            border-bottom:10px solid ${color};
            transform:rotate(${v.angle}deg);
            transform-origin:4px 13px;
          "></div>` : ""}
        </div>
        <span style="
          margin-top:4px;font-size:10px;font-weight:600;
          font-family:monospace;color:#333;
          background:rgba(255,255,255,0.9);
          padding:1px 5px;border-radius:2px;
          white-space:nowrap;
        ">#${v.car_id}</span>
        <span style="
          font-size:9px;color:#666;
          margin-top:1px;
        ">${v.speed.toFixed(1)} m/s${hasAngle ? " · " + v.angle?.toFixed(0) + "°" : ""}</span>
      `

      const marker = new AMap.Marker({
        position: [v.x, v.y] as [number, number],
        content: el,
        offset: new AMap.Pixel(0, -25),
        zIndex: isSelected ? 300 : alive ? 200 : 100,
      })

      el.addEventListener("click", (e) => {
        e.stopPropagation()
        onSelectRef.current(v)
      })

      marker.setMap(map)
      markers.push(marker)
    }

    markersRef.current = markers
    map.setFitView(null, false, [80, 80, 80, 80])
  }, [vehicles, selectedId])

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
          <p className="text-xs text-muted-foreground/40">地图加载失败: {error}</p>
        </div>
      )}
    </div>
  )
}
