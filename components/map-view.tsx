"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import type { CarPosition } from "@/lib/api"
import {
  type AMapMarkerInstance,
  type AMapNamespace,
  type MapEntry,
  loadAmap,
  createAmapMap,
  resolveMapStyle,
  detectWebglUsed,
} from "@/lib/amap"
import { upgradeTileResolution } from "@/lib/map-tiles"
import { vehicleMarkerSvg, robotMarkerSvg } from "@/lib/map-markers"
import { batteryMarkerColor } from "@/lib/battery"

/* ==================== 组件 ==================== */

interface MapViewProps {
  vehicles: CarPosition[]
}

export function MapView({ vehicles }: MapViewProps) {
  const { resolvedTheme } = useTheme()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<MapEntry | null>(null)
  const markersRef = React.useRef<AMapMarkerInstance[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  // WebGL 是否被高德实际使用：false 时地图降级为 img 瓦片渲染，主题无法切换，强制亮色
  const [webglUsed, setWebglUsed] = React.useState<boolean | null>(null)

  const mapStyle = React.useMemo(
    () => resolveMapStyle(resolvedTheme, webglUsed),
    [resolvedTheme, webglUsed]
  )

  // 主初始化 effect 需要初始 mapStyle，但不随主题重建地图：用 ref 传递
  const mapStyleRef = React.useRef(mapStyle)
  React.useEffect(() => {
    mapStyleRef.current = mapStyle
  }, [mapStyle])

  React.useEffect(() => {
    let cancelled = false
    // 复制容器引用，避免 cleanup 时 ref 已变化
    const container = containerRef.current
    let tileObserver: MutationObserver | null = null

    loadAmap(["AMap.Scale", "AMap.ToolBar"])
      .then((AMap: AMapNamespace) => {
        if (cancelled || !container) return

        // WebGL 渲染：纹理线性过滤比 img 瓦片放大更平滑，缓解高分屏模糊
        const map = createAmapMap(AMap, container, mapStyleRef.current)

        map.addControl(new AMap.Scale())
        map.addControl(new AMap.ToolBar({ position: "RT" }))

        // 容器尺寸稳定后强制重算，确保按真实尺寸渲染
        map.on("complete", () => {
          map.resize()
          tileObserver = upgradeTileResolution(container)
          // 检测高德是否实际使用 WebGL 渲染（WebGL 渲染会创建 canvas，img 瓦片降级则无 canvas）
          setWebglUsed(detectWebglUsed(container))
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
      tileObserver?.disconnect()
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

      const el = document.createElement("div")
      el.style.cssText = "display:flex;flex-direction:column;align-items:center;"
      // WebGL 不可用时地图降级为亮色渲染，marker 固定用亮色主题主色（近黑，非黄色）以保证可见
      // 低电量优先用黄/红标记
      const batteryColor = batteryMarkerColor(v.battery)
      const dropColor =
        batteryColor ??
        (webglUsed === false ? "#212121" : "var(--color-primary,#f59e0b)")
      el.innerHTML = `
        ${v.kind === "robot"
          ? robotMarkerSvg({ color: dropColor, angle: v.yaw, alive })
          : vehicleMarkerSvg({ color: dropColor, angle: v.yaw, alive })}
        <span style="
          margin-top:3px;font-size:10px;font-weight:600;
          font-family:monospace;color:#333;
          background:rgba(255,255,255,0.9);
          padding:1px 4px;border-radius:2px;
          white-space:nowrap;
        ">#${v.car_id}</span>
      `

      const marker = new AMap.Marker({
        position: [v.lon, v.lat] as [number, number],
        content: el,
        offset: new AMap.Pixel(0, -18),
        zIndex: alive ? 200 : 100,
      })
      marker.setMap(map)
      markers.push(marker)
    }

    markersRef.current = markers
    map.setFitView(null, false, [80, 80, 80, 80])
  }, [vehicles, webglUsed])

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
