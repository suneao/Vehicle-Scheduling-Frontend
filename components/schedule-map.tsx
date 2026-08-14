"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import type { CarPosition } from "@/lib/api"
import type { Route } from "@/lib/routes"
import {
  type AMapMarkerInstance,
  type AMapPolylineInstance,
  type AMapNamespace,
  type MapOverlay,
  type DrivingResult,
  type MapEntry,
  loadAmap,
  createAmapMap,
  resolveMapStyle,
  detectWebglUsed,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
} from "@/lib/amap"
import { pointMarkerHtml, endMarkerHtml, stopMarkerHtml, vehicleMarkerSvg, robotMarkerSvg } from "@/lib/map-markers"
import { upgradeTileResolution } from "@/lib/map-tiles"
import { batteryMarkerColor } from "@/lib/battery"
import { ON_ROUTE_THRESHOLD, projectToPath, splitPathAt } from "@/lib/route-geometry"
import { Button } from "@/components/ui/button"
import { LocateFixedIcon, MoveIcon, CrosshairIcon } from "lucide-react"



interface ScheduleMapProps {
  vehicles: CarPosition[]
  onSelect: (vehicle: CarPosition | null) => void
  selectedId?: number
  /** 选中车辆/机器狗正在执行的路线（用于地图上展示） */
  assignedRoute?: Route | null
  /** 在路线上时的起始方式：start = 导航到起点；current = 从当前位置开始 */
  startMode: "start" | "current"
  onStartModeChange: (mode: "start" | "current") => void
  /** 常驻显示的全部巡逻路线（半透明底图，供机器狗调度页） */
  overviewRoutes?: Route[]
}

export function ScheduleMap({ vehicles, onSelect, selectedId, assignedRoute, startMode, onStartModeChange, overviewRoutes }: ScheduleMapProps) {
  const { resolvedTheme } = useTheme()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<MapEntry | null>(null)
  const markersRef = React.useRef<AMapMarkerInstance[]>([])
  const routeOverlaysRef = React.useRef<MapOverlay[]>([])
  const overviewOverlaysRef = React.useRef<MapOverlay[]>([])
  const routeProgressRef = React.useRef<AMapPolylineInstance[]>([])
  const routeProgressKeyRef = React.useRef<string>("")
  const navProgressRef = React.useRef<AMapPolylineInstance[]>([])
  const navProgressKeyRef = React.useRef<string>("")
  const routeFitKeyRef = React.useRef<string | null>(null)
  const navKeyRef = React.useRef<string | null>(null)
  const onSelectRef = React.useRef(onSelect)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  // 视角模式：follow = 跟随选中车辆/自动囊括所有车辆；free = 自由拖动
  const [mode, setMode] = React.useState<"follow" | "free">("follow")
  // 规划出的导航路径结果（异步回调写入）；key 用于区分当前选中对象/路线
  const [resolvedNav, setResolvedNav] = React.useState<{
    key: string
    path: [number, number][]
  } | null>(null)
  // WebGL 是否被高德实际使用：false 时地图降级为 img 瓦片渲染，主题无法切换，强制亮色
  const [webglUsed, setWebglUsed] = React.useState<boolean | null>(null)

  // ===== 选中车辆与路线相关派生状态 =====
  const navKey = `${selectedId}:${assignedRoute?.id ?? "none"}`
  const selectedVehicle = vehicles.find((item) => item.car_id === selectedId)
  const routePathForCheck = assignedRoute
    ? (assignedRoute.path && assignedRoute.path.length >= 2
        ? assignedRoute.path
        : assignedRoute.points
      ).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    : []
  const onRoute =
    selectedVehicle && routePathForCheck.length >= 2
      ? projectToPath(routePathForCheck, [selectedVehicle.x, selectedVehicle.y])
          .distance <= ON_ROUTE_THRESHOLD
      : false
  // 兜底直线（车辆当前位置 → 路线起点）
  const fallbackNavPath: [number, number][] | null =
    !onRoute && selectedVehicle && assignedRoute && assignedRoute.points.length >= 2
      ? [[selectedVehicle.x, selectedVehicle.y], assignedRoute.points[0]]
      : null
  // 有效导航路径：已规划用结果，否则用兜底直线；在路线上时无导航
  const effectiveNavPath: [number, number][] | null = onRoute
    ? null
    : resolvedNav && resolvedNav.key === navKey
      ? resolvedNav.path
      : fallbackNavPath

  const mapStyle = React.useMemo(
    () => resolveMapStyle(resolvedTheme, webglUsed),
    [resolvedTheme, webglUsed]
  )

  // 主初始化 effect 需要初始 mapStyle，但不随主题重建地图：用 ref 传递
  const mapStyleRef = React.useRef(mapStyle)
  React.useEffect(() => {
    mapStyleRef.current = mapStyle
  }, [mapStyle])

  // 保持最新回调（不能直接在 render 中改 ref）
  React.useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  // 初始化地图
  React.useEffect(() => {
    let cancelled = false
    const container = containerRef.current
    let tileObserver: MutationObserver | null = null

    loadAmap(["AMap.Scale", "AMap.Driving"])
      .then((AMap: AMapNamespace) => {
        if (cancelled || !container) return

        // viewMode 3D 支持地图旋转，pitch 0 保持平面俯视（视觉等同 2D）
        const map = createAmapMap(AMap, container, mapStyleRef.current)
        map.addControl(new AMap.Scale())
        map.on("complete", () => {
          map.resize()
          tileObserver = upgradeTileResolution(container)
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

  // 主题切换
  React.useEffect(() => {
    mapRef.current?.instance?.setMapStyle(mapStyle)
  }, [mapStyle])

  // 常驻显示全部巡逻路线（半透明底图，供机器狗调度页）
  React.useEffect(() => {
    const entry = mapRef.current
    if (!entry) return
    const { instance: map, AMap } = entry

    for (const o of overviewOverlaysRef.current) o.setMap(null)
    overviewOverlaysRef.current = []

    if (!overviewRoutes || overviewRoutes.length === 0) return

    const isValidPoint = (p: [number, number]) =>
      Number.isFinite(p[0]) && Number.isFinite(p[1])

    for (const route of overviewRoutes) {
      const points = (
        route.path && route.path.length >= 2 ? route.path : route.points
      ).filter(isValidPoint)
      if (points.length < 2) continue
      const poly = new AMap.Polyline({
        path: points,
        strokeColor: route.color ?? "#3b82f6",
        strokeWeight: 4,
        strokeOpacity: 0.3,
        strokeStyle: "solid",
        lineJoin: "round",
        lineCap: "round",
      })
      poly.setMap(map)
      overviewOverlaysRef.current.push(poly)
    }
  }, [overviewRoutes])

  // 选中路线的静态部分：描边 + 起/终/站点标记（只在路线/主题变化时重建）
  React.useEffect(() => {
    const entry = mapRef.current
    if (!entry) return
    const { instance: map, AMap } = entry

    for (const o of routeOverlaysRef.current) o.setMap?.(null)
    routeOverlaysRef.current = []

    const isValidPoint = (p: [number, number]) =>
      Number.isFinite(p[0]) && Number.isFinite(p[1])
    if (!assignedRoute) return
    // 贴路路径优先（无则用航点直线连接）
    const points = (
      assignedRoute.path && assignedRoute.path.length >= 2
        ? assignedRoute.path
        : assignedRoute.points
    ).filter(isValidPoint)
    if (points.length < 2) return

    const color = assignedRoute.color ?? "#3b82f6"
    const casingColor =
      webglUsed === false || resolvedTheme !== "dark"
        ? "rgba(15,23,42,0.42)"
        : "rgba(255,255,255,0.38)"

    // 深色描边（整条路线）
    const casing = new AMap.Polyline({
      path: points,
      strokeColor: casingColor,
      strokeWeight: 8.5,
      strokeOpacity: 1,
      strokeStyle: "solid",
      lineJoin: "round",
      lineCap: "round",
    })
    casing.setMap(map)
    routeOverlaysRef.current.push(casing)

    // 起点（实心圆 + 起）与终点（白色圆环 + 终）标记
    const startMarker = new AMap.Marker({
      position: points[0],
      offset: new AMap.Pixel(-9, -9),
      content: pointMarkerHtml(color, "起", 18),
      zIndex: 90,
    })
    startMarker.setMap(map)
    routeOverlaysRef.current.push(startMarker)

    const endMarker = new AMap.Marker({
      position: points[points.length - 1],
      offset: new AMap.Pixel(-9, -9),
      content: endMarkerHtml(color),
      zIndex: 90,
    })
    endMarker.setMap(map)
    routeOverlaysRef.current.push(endMarker)

    // 途径站点：菱形标记（位于航点上）
    if (Array.isArray(assignedRoute.stops)) {
      assignedRoute.stops.forEach((s, i) => {
        const wp = assignedRoute.points[i]
        if (!s || !wp) return
        const stopMarker = new AMap.Marker({
          position: wp,
          offset: new AMap.Pixel(-9, -9),
          content: stopMarkerHtml(color),
          zIndex: 90,
        })
        stopMarker.setMap(map)
        routeOverlaysRef.current.push(stopMarker)
      })
    }
  }, [assignedRoute, resolvedTheme, webglUsed])

  // 进度分段（已行驶浅/未行驶实）：随车辆移动原地更新，避免每秒重建闪烁
  React.useEffect(() => {
    const entry = mapRef.current
    if (!entry) return
    const { instance: map, AMap } = entry

    const routeKey = assignedRoute
      ? `${assignedRoute.id}:${assignedRoute.color ?? ""}`
      : "none"
    const isValidPoint = (p: [number, number]) =>
      Number.isFinite(p[0]) && Number.isFinite(p[1])
    const points = assignedRoute
      ? (assignedRoute.path && assignedRoute.path.length >= 2
          ? assignedRoute.path
          : assignedRoute.points
        ).filter(isValidPoint)
      : []
    const color = assignedRoute?.color ?? "#3b82f6"

    let before: [number, number][] | null = null
    let after: [number, number][] = []
    let beforeOpacity = 0.3
    const afterOpacity = 0.9

    if (points.length >= 2) {
      const v = vehicles.find((item) => item.car_id === selectedId)
      const proj = v ? projectToPath(points, [v.x, v.y]) : null
      if (v && proj && proj.distance <= ON_ROUTE_THRESHOLD) {
        const split = splitPathAt(points, [v.x, v.y])
        before = split.before
        after = split.after
        beforeOpacity = startMode === "start" ? 0.3 : 0.15
      } else {
        before = null
        after = points
      }
    }

    // 路线变化时重建进度线（用整条路线作为初始有效路径，避免 AMap 报空路径）
    if (routeProgressKeyRef.current !== routeKey) {
      routeProgressKeyRef.current = routeKey
      for (const o of routeProgressRef.current) o.setMap(null)
      routeProgressRef.current = []
      if (points.length >= 2) {
        for (let i = 0; i < 2; i++) {
          const poly = new AMap.Polyline({
            path: points,
            strokeColor: color,
            strokeWeight: 5,
            strokeOpacity: 0.9,
            strokeStyle: "solid",
            lineJoin: "round",
            lineCap: "round",
            showDir: true,
          })
          poly.setMap(map)
          routeProgressRef.current.push(poly)
        }
      }
    }

    const [beforePoly, afterPoly] = routeProgressRef.current
    if (beforePoly) {
      if (before && before.length >= 2) {
        beforePoly.setPath(before)
        beforePoly.setOptions({ strokeOpacity: beforeOpacity })
        beforePoly.setMap(map)
      } else {
        beforePoly.setMap(null)
      }
    }
    if (afterPoly) {
      if (after && after.length >= 2) {
        afterPoly.setPath(after)
        afterPoly.setOptions({ strokeOpacity: afterOpacity })
        afterPoly.setMap(map)
      } else {
        afterPoly.setMap(null)
      }
    }
  }, [assignedRoute, vehicles, selectedId, startMode])

  // 导航到路线起点：调用高德驾车路径规划 API，结果写入 resolvedNav（仅异步回调）
  React.useEffect(() => {
    const entry = mapRef.current
    if (!entry) return
    const { AMap } = entry

    // 仅在选中对象/路线变化时重新规划，避免每秒轮询反复请求 API
    if (navKeyRef.current === navKey) return
    navKeyRef.current = navKey

    // 已在路线上或数据不足：无需规划
    if (onRoute || !assignedRoute || assignedRoute.points.length < 2 || !selectedVehicle) return

    const origin: [number, number] = [selectedVehicle.x, selectedVehicle.y]
    const dest = assignedRoute.points[0]

    const doResolve = () => {
      const driving = new AMap.Driving({ policy: 0 }) // 0 = 速度优先
      driving.search(origin, dest, (status: string, result: DrivingResult) => {
        if (status !== "complete") return
        const steps = result.routes?.[0]?.steps
        if (!Array.isArray(steps)) return
        const path = steps.flatMap((s) => s.path ?? [])
        if (path.length < 2) return
        setResolvedNav({
          key: navKey,
          path: path.map((p) => (Array.isArray(p) ? p : [p.getLng(), p.getLat()])),
        })
      })
    }

    if (typeof AMap.Driving === "function") {
      doResolve()
    } else {
      // 插件未就绪：显式加载后重试
      AMap.plugin("AMap.Driving", () => {
        if (typeof AMap.Driving === "function") doResolve()
      })
    }
  }, [vehicles, selectedId, assignedRoute, navKey, onRoute, selectedVehicle])

  // 渲染导航线：按车辆当前位置拆分已行驶（浅）/未行驶（实虚线），原地更新避免闪烁
  React.useEffect(() => {
    const entry = mapRef.current
    if (!entry) return
    const { instance: map, AMap } = entry

    const navPath =
      effectiveNavPath && effectiveNavPath.length >= 2 ? effectiveNavPath : null
    const v = vehicles.find((item) => item.car_id === selectedId)

    const casingColor =
      webglUsed === false || resolvedTheme !== "dark"
        ? "rgba(15,23,42,0.35)"
        : "rgba(255,255,255,0.35)"

    const progressKey = `${navKey}:${
      navPath ? (resolvedNav?.key === navKey ? "resolved" : "fallback") : "none"
    }`

    let before: [number, number][] | null = null
    let after: [number, number][] = []
    if (navPath && v) {
      const split = splitPathAt(navPath, [v.x, v.y])
      before = split.before
      after = split.after
    }

    // 选中对象/导航类型变化时重建（用导航路径作为初始有效路径）
    if (navProgressKeyRef.current !== progressKey) {
      navProgressKeyRef.current = progressKey
      for (const o of navProgressRef.current) o.setMap(null)
      navProgressRef.current = []
      if (navPath) {
        const make = (dashed: boolean) => {
          const poly = new AMap.Polyline({
            path: navPath,
            strokeColor: dashed ? "#64748b" : casingColor,
            strokeWeight: dashed ? 4 : 7,
            strokeOpacity: 0.85,
            strokeStyle: dashed ? "dashed" : "solid",
            ...(dashed ? { strokeDasharray: [8, 6] } : {}),
            lineJoin: "round",
            lineCap: "round",
          })
          poly.setMap(map)
          navProgressRef.current.push(poly)
          return poly
        }
        make(false) // before 描边
        make(true) // before 虚线
        make(false) // after 描边
        make(true) // after 虚线
      }
    }

    const [beforeCasing, beforeLine, afterCasing, afterLine] = navProgressRef.current

    const apply = (
      poly: AMapPolylineInstance | undefined,
      seg: [number, number][] | null,
      opacity: number
    ) => {
      if (!poly) return
      if (seg && seg.length >= 2) {
        poly.setPath(seg)
        poly.setOptions({ strokeOpacity: opacity })
        poly.setMap(map)
      } else {
        poly.setMap(null)
      }
    }

    apply(beforeCasing, before, 1)
    apply(beforeLine, before, 0.35)
    apply(afterCasing, after, 1)
    apply(afterLine, after, 0.85)
  }, [effectiveNavPath, vehicles, selectedId, navKey, resolvedNav, webglUsed, resolvedTheme])

  // 视角控制：跟随模式自动调整地图视角
  React.useEffect(() => {
    const map = mapRef.current?.instance
    if (!map) return
    if (mode === "free") return

    // 选中车辆/机器狗
    if (selectedId != null) {
      // 有执行路线：视野适配整条路线（含车辆，车辆在路线上移动）
      const fitKey = `${selectedId}:${assignedRoute?.id ?? "none"}`
      if (
        assignedRoute &&
        assignedRoute.points.length >= 2 &&
        routeFitKeyRef.current !== fitKey
      ) {
        const overlays = routeOverlaysRef.current.filter(Boolean)
        if (overlays.length > 0) {
          routeFitKeyRef.current = fitKey
          map.setRotation(0)
          map.setPitch(0)
          map.setFitView(overlays, false, [70, 70, 70, 70])
          return
        }
      }
      const v = vehicles.find((item) => item.car_id === selectedId)
      if (v) {
        map.setCenter([v.x, v.y])
        map.setPitch(0)
        // 放大到局部视角（不低于 18 级）
        if (map.getZoom() < 18) map.setZoom(18)
      }
      return
    }

    // 未选中：动态囊括所有车辆的最佳视角
    routeFitKeyRef.current = null
    map.setRotation(0)
    map.setPitch(0)
    if (vehicles.length > 0) {
      map.setFitView(null, false, [60, 60, 60, 60])
    }
  }, [vehicles, selectedId, mode, assignedRoute])

  // 居中按钮：重置视角为初始位置
  function centerMap() {
    const map = mapRef.current?.instance
    if (!map) return
    map.setCenter(DEFAULT_CENTER)
    map.setZoom(DEFAULT_ZOOM)
    map.setRotation(0)
    map.setPitch(0)
  }

  // 地图是否处于强制亮色模式（WebGL 不可用时）：按钮需用亮色配置
  const lightMap = webglUsed === false

  // 模式按钮样式：选中时固定背景不 hover 反转（避免边框与 hover 背景同色），选中边框用主题主色
  function modeBtnClass(active: boolean, light: boolean): string {
    if (light) {
      // 亮色地图模式：强制白底黑字（! 覆盖 outline 变体的 dark 半透明背景/边框）
      return active
        ? "gap-1 border-2 border-black! bg-white! text-black"
        : "gap-1 border border-neutral-300 bg-white! text-black hover:bg-black! hover:text-white!"
    }
    return active
      ? "gap-1 border-2 border-primary! bg-background text-foreground"
      : "gap-1 border border-border bg-background text-foreground hover:bg-foreground hover:text-background"
  }

  // 居中按钮样式（无选中态）
  function centerBtnClass(light: boolean): string {
    return light
      ? "size-7 border border-neutral-300 bg-white! p-0! text-black hover:bg-black! hover:text-white!"
      : "size-7 border border-border bg-background p-0! text-foreground hover:bg-foreground hover:text-background"
  }

  // 更新车辆标记（先绘制新标记、再移除旧标记，避免每秒重建闪烁）
  React.useEffect(() => {
    const entry = mapRef.current
    if (!entry) return
    const { instance: map, AMap } = entry

    const oldMarkers = markersRef.current
    markersRef.current = []

    const markers: AMapMarkerInstance[] = []

    for (const v of vehicles) {
      const alive = v.speed > 0
      const hasAngle = v.angle != null
      const isSelected = v.car_id === selectedId
      // WebGL 不可用时地图降级为亮色渲染，marker 固定用亮色主题主色（近黑，非黄色）以保证可见
      // 低电量优先用黄/红标记（选中态仍用绿色突出选中）
      const batteryColor = batteryMarkerColor(v.battery)
      const base = isSelected
        ? "#22c55e"
        : batteryColor ?? (webglUsed === false ? "#212121" : "var(--color-primary,#f59e0b)")

      const el = document.createElement("div")
      el.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;"
      el.innerHTML = `
        ${v.kind === "robot"
          ? robotMarkerSvg({ color: base, angle: v.angle, alive, selected: isSelected })
          : vehicleMarkerSvg({ color: base, angle: v.angle, alive, selected: isSelected })}
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
        // 再次单击已选中的车辆 → 取消选中
        if (v.car_id === selectedId) {
          onSelectRef.current(null)
        } else {
          onSelectRef.current(v)
        }
      })

      marker.setMap(map)
      markers.push(marker)
    }

    markersRef.current = markers

    // 新标记已绘制后，再移除旧标记
    for (const m of oldMarkers) m.setMap(null)
  }, [vehicles, selectedId, webglUsed])

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

  return (
    // 绝对定位填满父级（父级需 relative），避免 flex 中 height:100% 解析为 0 导致渲染模糊
    // isolate + overflow-hidden：隔离层叠并裁剪越界覆盖物，防止拦截相邻面板点击
    <div className="absolute inset-0 isolate overflow-hidden">
      <div ref={containerRef} className="size-full" />

      {/* 在路线上的起始方式（左上角） */}
      {!loading && !error && onRoute && (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStartModeChange("start")}
            className={modeBtnClass(startMode === "start", lightMap)}
          >
            从起点开始
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStartModeChange("current")}
            className={modeBtnClass(startMode === "current", lightMap)}
          >
            从当前位置开始
          </Button>
        </div>
      )}

      {/* 视角控制按钮（右上角，独立按钮） */}
      {!loading && !error && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode("follow")}
            className={modeBtnClass(mode === "follow", lightMap)}
          >
            <LocateFixedIcon className="size-3.5" />
            跟随
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode("free")}
            className={modeBtnClass(mode === "free", lightMap)}
          >
            <MoveIcon className="size-3.5" />
            自由
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={centerMap}
            aria-label="居中"
            className={centerBtnClass(lightMap)}
          >
            <CrosshairIcon className="size-3.5" />
          </Button>
        </div>
      )}

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
