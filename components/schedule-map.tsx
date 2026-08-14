"use client"

import * as React from "react"
import AMapLoader from "@amap/amap-jsapi-loader"
import { useTheme } from "next-themes"
import type { CarPosition } from "@/lib/api"
import type { Route } from "@/lib/routes"
import { getMapThemeConfig } from "@/lib/map-theme"
import { pointMarkerHtml, endMarkerHtml, stopMarkerHtml } from "@/lib/map-markers"
import { upgradeTileResolution } from "@/lib/map-tiles"
import { Button } from "@/components/ui/button"
import { LocateFixedIcon, MoveIcon, CrosshairIcon } from "lucide-react"

/* ==================== 高德类型声明 ==================== */

/** 地图实例最小类型 */
interface AMapMapInstance {
  destroy: () => void
  resize: () => void
  setFitView: (overlays: unknown[] | null, immediately: boolean, padding: number[]) => void
  setMapStyle: (style: string) => void
  addControl: (control: unknown) => void
  on: (event: string, handler: () => void) => void
  getZoom: () => number
  setZoom: (zoom: number) => void
  setCenter: (center: [number, number]) => void
  setRotation: (deg: number, immediate?: boolean) => void
  setPitch: (pitch: number) => void
}

/** 标记实例最小类型 */
interface AMapMarkerInstance {
  setMap: (map: AMapMapInstance | null) => void
}

/** AMap 命名空间最小类型 */
interface AMapNamespace {
  Map: new (container: HTMLElement, opts: Record<string, unknown>) => AMapMapInstance
  Marker: new (opts: Record<string, unknown>) => AMapMarkerInstance
  Polyline: new (opts: Record<string, unknown>) => {
    setMap: (map: AMapMapInstance | null) => void
  }
  Pixel: new (x: number, y: number) => unknown
  Scale: new () => unknown
  ToolBar: new (opts: Record<string, unknown>) => unknown
  Driving: new (opts: Record<string, unknown>) => {
    search: (
      origin: [number, number],
      dest: [number, number],
      callback: (status: string, result: DrivingResult) => void
    ) => void
  }
  plugin: (name: string, callback: () => void) => void
}

/** 地图覆盖物（标记/折线）最小类型 */
interface MapOverlay {
  setMap: (map: AMapMapInstance | null) => void
}

/** 驾车规划结果中的坐标（LngLat 或 [lng, lat]） */
type AmapLngLat = [number, number] | { getLng(): number; getLat(): number }

/** 驾车规划返回结构 */
interface DrivingResult {
  routes?: Array<{ steps?: Array<{ path?: AmapLngLat[] }> }>
}

const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY ?? ""
const AMAP_SECURITY_CODE = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE ?? ""

const DEFAULT_CENTER: [number, number] = [114.003, 22.602]
const DEFAULT_ZOOM = 16

/** 视为“已在路线上”的距离阈值（约 33 米） */
const ON_ROUTE_THRESHOLD = 3e-4

/** 路径上距离某点最近的位置（返回投影点、所在段索引与距离） */
function projectToPath(
  path: [number, number][],
  pos: [number, number]
): { index: number; point: [number, number]; distance: number } {
  if (path.length === 0) {
    return { index: 0, point: pos, distance: Infinity }
  }
  let bestIdx = 0
  let bestPoint: [number, number] = path[0]
  let bestD = Infinity
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy
    const t =
      len2 === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((pos[0] - a[0]) * dx + (pos[1] - a[1]) * dy) / len2)
          )
    const point: [number, number] = [a[0] + t * dx, a[1] + t * dy]
    const d = Math.hypot(pos[0] - point[0], pos[1] - point[1])
    if (d < bestD) {
      bestD = d
      bestIdx = i
      bestPoint = point
    }
  }
  return { index: bestIdx, point: bestPoint, distance: bestD }
}

/** 在最近投影点处把路径拆成「已行驶」和「未行驶」两段 */
function splitPathAt(
  path: [number, number][],
  pos: [number, number]
): { before: [number, number][]; after: [number, number][] } {
  if (path.length < 2) return { before: path, after: [] }
  const { index, point } = projectToPath(path, pos)
  return {
    before: [...path.slice(0, index + 1), point],
    after: [point, ...path.slice(index + 1)],
  }
}

interface ScheduleMapProps {
  vehicles: CarPosition[]
  onSelect: (vehicle: CarPosition | null) => void
  selectedId?: number
  /** 选中车辆/机器狗正在执行的路线（用于地图上展示） */
  assignedRoute?: Route | null
}

export function ScheduleMap({ vehicles, onSelect, selectedId, assignedRoute }: ScheduleMapProps) {
  const { resolvedTheme } = useTheme()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<{ instance: AMapMapInstance; AMap: AMapNamespace } | null>(null)
  const markersRef = React.useRef<AMapMarkerInstance[]>([])
  const routeOverlaysRef = React.useRef<MapOverlay[]>([])
  const navOverlaysRef = React.useRef<MapOverlay[]>([])
  const routeFitKeyRef = React.useRef<string | null>(null)
  const navKeyRef = React.useRef<string | null>(null)
  const onSelectRef = React.useRef(onSelect)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  // 视角模式：follow = 跟随选中车辆/自动囊括所有车辆；free = 自由拖动
  const [mode, setMode] = React.useState<"follow" | "free">("follow")
  // 在路线上时的起始方式：start = 从起点开始；current = 从当前位置开始
  const [startMode, setStartMode] = React.useState<"start" | "current">("start")
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

  // 保持最新回调（不能直接在 render 中改 ref）
  React.useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  // 初始化地图
  React.useEffect(() => {
    let cancelled = false
    const container = containerRef.current
    let tileObserver: MutationObserver | null = null
    window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE }

    AMapLoader.load({ key: AMAP_KEY, version: "2.0", plugins: ["AMap.Scale", "AMap.Driving"] })
      .then((AMap: AMapNamespace) => {
        if (cancelled || !container) return

        const map = new AMap.Map(container, {
          // viewMode 3D 支持地图旋转，pitch 0 保持平面俯视（视觉等同 2D）
          viewMode: "3D",
          pitch: 0,
          rotation: 0,
          zoom: DEFAULT_ZOOM,
          center: DEFAULT_CENTER,
          mapStyle: mapStyleRef.current,
          resizeEnable: true,
          devicePixelRatio: 2,
        })
        map.addControl(new AMap.Scale())
        map.on("complete", () => {
          map.resize()
          tileObserver = upgradeTileResolution(container)
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
      tileObserver?.disconnect()
      mapRef.current?.instance?.destroy()
      mapRef.current = null
    }
  }, [])

  // 主题切换
  React.useEffect(() => {
    mapRef.current?.instance?.setMapStyle(mapStyle)
  }, [mapStyle])

  // 选中车辆/机器狗的执行路线：带描边 + 进度高亮（已行驶更浅，实时更新）
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

    // 主色线：按车辆进度分段（已行驶浅、未行驶实）
    const drawSegment = (path: [number, number][], opacity: number) => {
      if (path.length < 2) return
      const poly = new AMap.Polyline({
        path,
        strokeColor: color,
        strokeWeight: 5,
        strokeOpacity: opacity,
        strokeStyle: "solid",
        lineJoin: "round",
        lineCap: "round",
        showDir: true,
      })
      poly.setMap(map)
      routeOverlaysRef.current.push(poly)
    }

    const v = vehicles.find((item) => item.car_id === selectedId)
    const proj = v ? projectToPath(points, [v.x, v.y]) : null
    if (v && proj && proj.distance <= ON_ROUTE_THRESHOLD) {
      // 在路线上：按已行驶/未行驶分段
      const { before, after } = splitPathAt(points, [v.x, v.y])
      if (startMode === "start") {
        drawSegment(before, 0.3) // 已行驶（浅）
        drawSegment(after, 0.9) // 未行驶（实）
      } else {
        drawSegment(before, 0.15) // 起点前部分（幽灵，表示从当前位置开始）
        drawSegment(after, 0.9) // 未行驶（实）
      }
    } else {
      // 不在路线上：整条路线实色（导航线另行显示进度）
      drawSegment(points, 0.9)
    }

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
  }, [assignedRoute, resolvedTheme, webglUsed, vehicles, selectedId, startMode])

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

  // 渲染导航线：按车辆当前位置拆分已行驶（浅）/未行驶（实虚线），实时更新
  React.useEffect(() => {
    const entry = mapRef.current
    if (!entry) return
    const { instance: map, AMap } = entry

    for (const o of navOverlaysRef.current) o.setMap?.(null)
    navOverlaysRef.current = []

    if (!effectiveNavPath || effectiveNavPath.length < 2) return

    const v = vehicles.find((item) => item.car_id === selectedId)
    if (!v) return

    const casingColor =
      webglUsed === false || resolvedTheme !== "dark"
        ? "rgba(15,23,42,0.35)"
        : "rgba(255,255,255,0.35)"

    const drawNavLine = (seg: [number, number][], opacity: number) => {
      if (seg.length < 2) return
      const casing = new AMap.Polyline({
        path: seg,
        strokeColor: casingColor,
        strokeWeight: 7,
        strokeOpacity: 1,
        strokeStyle: "solid",
        lineJoin: "round",
        lineCap: "round",
      })
      casing.setMap(map)
      navOverlaysRef.current.push(casing)
      const line = new AMap.Polyline({
        path: seg,
        strokeColor: "#64748b",
        strokeWeight: 4,
        strokeOpacity: opacity,
        strokeStyle: "dashed",
        strokeDasharray: [8, 6],
        lineJoin: "round",
        lineCap: "round",
      })
      line.setMap(map)
      navOverlaysRef.current.push(line)
    }

    const { before, after } = splitPathAt(effectiveNavPath, [v.x, v.y])
    drawNavLine(before, 0.35) // 已行驶（浅）
    drawNavLine(after, 0.85) // 未行驶（实）
  }, [effectiveNavPath, vehicles, selectedId, assignedRoute, resolvedTheme, webglUsed])

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

  // 更新车辆标记
  React.useEffect(() => {
    const entry = mapRef.current
    if (!entry) return
    const { instance: map, AMap } = entry

    for (const m of markersRef.current) m.setMap(null)
    markersRef.current = []

    if (vehicles.length === 0) return

    const markers: AMapMarkerInstance[] = []

    for (const v of vehicles) {
      const alive = v.speed > 0
      const hasAngle = v.angle != null
      const isSelected = v.car_id === selectedId
      // WebGL 不可用时地图降级为亮色渲染，marker 固定用亮色主题主色（近黑，非黄色）以保证可见
      const base = isSelected
        ? "#22c55e"
        : webglUsed === false
          ? "#212121"
          : "var(--color-primary,#f59e0b)"

      const el = document.createElement("div")
      el.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;"
      el.innerHTML = `
        <svg width="${isSelected ? 20 : 16}" height="${isSelected ? 25 : 20}" viewBox="-2 -2 20 25" style="
          overflow:visible;
          /* 水滴尖端指示车辆朝向（地图不旋转，marker 直接指示方向） */
          transform:${hasAngle ? `rotate(${v.angle}deg)` : "none"};
          transform-box:fill-box;
          filter:drop-shadow(0 1px 2px rgba(0,0,0,0.25));
        ">
          <path d="M8 1 C 12 6.5 15 10 15 13 A 7 7 0 1 1 1 13 C 1 10 4 6.5 8 1 Z"
            fill="${base}" stroke="#fff" stroke-width="1.5"
            opacity="${alive || isSelected ? 1 : 0.6}" />
          <circle cx="8" cy="13" r="3.5" fill="none" stroke="#fff" stroke-width="1.5" />
        </svg>
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
            onClick={() => setStartMode("start")}
            className={modeBtnClass(startMode === "start", lightMap)}
          >
            从起点开始
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStartMode("current")}
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
