"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import {
  type MapEntry,
  type MapOverlay,
  type DrivingResult,
  type AmapLngLat,
  loadAmap,
  createAmapMap,
  resolveMapStyle,
  detectWebglUsed,
} from "@/lib/amap"
import { pointMarkerHtml, endMarkerHtml, stopMarkerHtml } from "@/lib/map-markers"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Route, RouteStop } from "@/lib/routes"
import { MaximizeIcon } from "lucide-react"

/**
 * Catmull-Rom 样条采样为平滑曲线（近似贝塞尔曲线，穿过所有航点）
 * @param points 航点（≥2）
 * @param samplesPerSegment 每段采样点数
 */
function computeCurvePath(
  points: [number, number][],
  samplesPerSegment = 24
): [number, number][] {
  if (points.length === 2) return points
  const result: [number, number][] = []
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment
      const t2 = t * t
      const t3 = t2 * t
      const x =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
      const y =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      result.push([x, y])
    }
  }
  result.push(points[points.length - 1])
  return result
}

interface RouteMapProps {
  /** 所有路线（用于预览） */
  routes: Route[]
  /** 选中的路线 id（高亮显示） */
  selectedRouteId?: number | null
  /** 绘制模式：true 时点击地图添加点到草稿路线 */
  drawing?: boolean
  /** 草稿路线点（航点） */
  draftPoints?: [number, number][]
  /** 草稿路线贴路路径（高德驾车规划，无则用航点直线连接） */
  draftPath?: [number, number][]
  /** 草稿贴路路径变更回调 */
  onDraftPathChange?: (path: [number, number][], src: [number, number][]) => void
  /** 编辑模式：true 时显示可拖拽的编辑点，点击地图在最近线段插入点 */
  editing?: boolean
  /** 编辑中的路径点（航点） */
  editPoints?: [number, number][]
  /** 编辑路线贴路路径（高德驾车规划，无则用航点直线连接） */
  editPath?: [number, number][]
  /** 编辑贴路路径变更回调 */
  onEditPathChange?: (path: [number, number][], src: [number, number][]) => void
  /** 编辑点变更回调（拖拽/插入后） */
  onEditPointsChange?: (points: [number, number][]) => void
  /** 路径生成模式：road = 高德驾车贴路；curve = 本地贝塞尔曲线；polyline = 直线折线 */
  pathMode?: "road" | "curve" | "polyline"
  /** 编辑中的途径站点（按 editPoints 索引对齐；null = 不停车） */
  editStops?: (RouteStop | null)[]
  /** 点击地图回调（绘制模式收集点） */
  onMapClick?: (point: [number, number]) => void
  /** 草稿点变更回调（双击删除草稿点） */
  onDraftPointsChange?: (points: [number, number][]) => void
  /** 点击已有路线折线回调 */
  onRouteClick?: (routeId: number) => void
}

export function RouteMap({
  routes,
  selectedRouteId,
  drawing,
  draftPoints = [],
  draftPath,
  onDraftPathChange,
  editing,
  editPoints = [],
  editPath,
  onEditPathChange,
  onEditPointsChange,
  pathMode = "road",
  editStops = [],
  onMapClick,
  onDraftPointsChange,
  onRouteClick,
}: RouteMapProps) {
  const { resolvedTheme } = useTheme()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<MapEntry | null>(null)
  const overlaysRef = React.useRef<MapOverlay[]>([])
  const onMapClickRef = React.useRef(onMapClick)
  const onDraftPointsChangeRef = React.useRef(onDraftPointsChange)
  const onRouteClickRef = React.useRef(onRouteClick)
  const onEditPointsChangeRef = React.useRef(onEditPointsChange)
  const onDraftPathChangeRef = React.useRef(onDraftPathChange)
  const onEditPathChangeRef = React.useRef(onEditPathChange)
  /** 每条路线的覆盖物（用于选中路线时聚焦视野） */
  const routeOverlayMapRef = React.useRef<Record<number, MapOverlay[]>>({})
  const [ready, setReady] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  // WebGL 是否被高德实际使用：false 时地图降级为 img 瓦片渲染，主题无法切换，强制亮色
  const [webglUsed, setWebglUsed] = React.useState<boolean | null>(null)
  // 地图是否处于强制亮色模式（WebGL 不可用时）：按钮/描边需用亮色配置
  const lightMap = webglUsed === false

  React.useEffect(() => {
    onMapClickRef.current = onMapClick
  }, [onMapClick])
  React.useEffect(() => {
    onDraftPointsChangeRef.current = onDraftPointsChange
  }, [onDraftPointsChange])
  React.useEffect(() => {
    onRouteClickRef.current = onRouteClick
  }, [onRouteClick])
  React.useEffect(() => {
    onEditPointsChangeRef.current = onEditPointsChange
  }, [onEditPointsChange])
  React.useEffect(() => {
    onDraftPathChangeRef.current = onDraftPathChange
  }, [onDraftPathChange])
  React.useEffect(() => {
    onEditPathChangeRef.current = onEditPathChange
  }, [onEditPathChange])

  const mapStyle = React.useMemo(
    () => resolveMapStyle(resolvedTheme, webglUsed),
    [resolvedTheme, webglUsed]
  )

  // 主初始化 effect 需要初始 mapStyle，但不随主题重建地图：用 ref 传递
  const mapStyleRef = React.useRef(mapStyle)
  React.useEffect(() => {
    mapStyleRef.current = mapStyle
  }, [mapStyle])

  // 初始化地图
  React.useEffect(() => {
    let cancelled = false
    const container = containerRef.current
    loadAmap(["AMap.Scale", "AMap.Driving"])
      .then((AMap) => {
        if (cancelled || !container) return
        const map = createAmapMap(AMap, container, mapStyleRef.current)
        map.addControl(new AMap.Scale())

        // 检测高德是否实际使用 WebGL 渲染（WebGL 渲染会创建 canvas，img 瓦片降级则无 canvas）
        map.on("complete", () => {
          setWebglUsed(detectWebglUsed(container))
        })

        // 地图点击（绘制模式收集点）
        map.on("click", (...args: unknown[]) => {
          const e = args[0] as { lnglat?: { getLng(): number; getLat(): number } }
          const lnglat = e?.lnglat
          if (lnglat) {
            onMapClickRef.current?.([lnglat.getLng(), lnglat.getLat()])
          }
        })

        mapRef.current = { instance: map, AMap }
        setReady(true)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setReady(false)
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

  // 草稿/编辑路线贴路解析：防抖调用高德驾车 API，把航点转换为贴合道路的路径
  React.useEffect(() => {
    const entry = mapRef.current
    if (!entry) return
    const { AMap } = entry

    const src = drawing ? draftPoints : editing ? editPoints : null
    if (!src) return
    const waypoints = src.filter(
      (p) => Number.isFinite(p[0]) && Number.isFinite(p[1])
    )
    // 高德驾车规划：起点 + 最多 16 个途经点 + 终点
    if (waypoints.length < 2 || waypoints.length > 18) return

    const report = (path: [number, number][] | null, status?: string) => {
      if (status && status !== "complete") {
        console.warn("[路线贴路] 驾车规划未完成:", status)
      }
      if (drawing) {
        onDraftPathChangeRef.current?.(path ?? [], waypoints)
      } else {
        onEditPathChangeRef.current?.(path ?? [], waypoints)
      }
    }

    // 折线模式：直接用航点直线连接（不生成 path）
    if (pathMode === "polyline") return

    // 贝塞尔曲线模式：本地样条采样，立即生成（无需 API/防抖）
    if (pathMode === "curve") {
      report(computeCurvePath(waypoints))
      return
    }

    const timer = setTimeout(() => {
      const extract = (status: string, result: DrivingResult): [number, number][] | null => {
        if (status !== "complete") return null
        const steps = result?.routes?.[0]?.steps
        if (!Array.isArray(steps)) return null
        const path = steps.flatMap((s) => s.path ?? [])
        if (path.length < 2) return null
        return path.map((p: AmapLngLat): [number, number] =>
          Array.isArray(p) ? [p[0], p[1]] : [p.getLng(), p.getLat()]
        )
      }

      const doResolve = () => {
        // 途经点通过 opts.waypoints 传入（官方文档用法）
        const driving = new AMap.Driving({ policy: 0 }) // 0 = 速度优先
        if (waypoints.length === 2) {
          driving.search(waypoints[0], waypoints[1], (status: string, result: DrivingResult) => {
            report(extract(status, result), status)
          })
        } else {
          driving.search(
            waypoints[0],
            waypoints[waypoints.length - 1],
            { waypoints: waypoints.slice(1, -1) },
            (status: string, result: DrivingResult) => {
              report(extract(status, result), status)
            }
          )
        }
      }

      if (typeof AMap.Driving === "function") {
        doResolve()
      } else {
        // 插件未就绪：显式加载后重试
        AMap.plugin("AMap.Driving", () => {
          if (typeof AMap.Driving === "function") doResolve()
          else report(null, "plugin-load-failed")
        })
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [drawing, editing, draftPoints, editPoints, ready, pathMode])

  // 渲染路线折线 + 草稿点
  React.useEffect(() => {
    const entry = mapRef.current
    if (!entry) return
    const { instance: map, AMap } = entry

    const isValidPoint = (p: [number, number]) =>
      Number.isFinite(p[0]) && Number.isFinite(p[1])
    const cleanDraft = drawing ? draftPoints.filter(isValidPoint) : []
    const cleanEdit = editing ? editPoints.filter(isValidPoint) : []
    // 贴路路径优先（无则退回航点直线连接）
    const draftLine =
      draftPath && draftPath.length >= 2 ? draftPath : cleanDraft
    const editLine = editPath && editPath.length >= 2 ? editPath : cleanEdit
    // 描边色随主题：亮色地图用深色描边，暗色地图用浅色描边；WebGL 不可用时地图强制亮色
    const casingColor =
      lightMap || resolvedTheme !== "dark"
        ? "rgba(15,23,42,0.42)"
        : "rgba(255,255,255,0.38)"

    /** 创建带描边的折线（描边 + 主色），可选点击回调与覆盖物收集器 */
    function addCasedPolyline(
      path: [number, number][],
      color: string,
      weight: number,
      opacity: number,
      onClick?: () => void,
      collect?: MapOverlay[]
    ) {
      const casing = new AMap.Polyline({
        path,
        strokeColor: casingColor,
        strokeWeight: weight + 3.5,
        strokeOpacity: 1,
        strokeStyle: "solid",
        lineJoin: "round",
        lineCap: "round",
      })
      casing.setMap(map)
      overlaysRef.current.push(casing)
      collect?.push(casing)
      if (onClick) casing.on("click", onClick)
      const poly = new AMap.Polyline({
        path,
        strokeColor: color,
        strokeWeight: weight,
        strokeOpacity: opacity,
        strokeStyle: "solid",
        lineJoin: "round",
        lineCap: "round",
        showDir: true,
      })
      poly.setMap(map)
      overlaysRef.current.push(poly)
      collect?.push(poly)
      if (onClick) poly.on("click", onClick)
      return poly
    }

    // 清除旧覆盖物
    for (const o of overlaysRef.current) o.setMap(null)
    overlaysRef.current = []
    routeOverlayMapRef.current = {}

    // 绘制草稿路线（绘制模式）
    if (drawing && draftLine.length >= 2) {
      addCasedPolyline(draftLine, "#22c55e", 6, 0.95)
    }

    // 绘制草稿点（绿色编号圆点，可拖拽调整，双击删除）
    if (drawing) {
      cleanDraft.forEach((p, i) => {
        const marker = new AMap.Marker({
          position: p,
          draggable: true,
          offset: new AMap.Pixel(-9, -9),
          content: pointMarkerHtml("#22c55e", String(i + 1)),
        })
        marker.on("dragend", (...args: unknown[]) => {
          const e = args[0] as {
            target?: { getPosition?: () => { getLng(): number; getLat(): number } | null }
          }
          const pos = e?.target?.getPosition?.()
          if (!pos) return
          const np: [number, number] = [pos.getLng(), pos.getLat()]
          if (!Number.isFinite(np[0]) || !Number.isFinite(np[1])) return
          const next = cleanDraft.map((pp, j) => (j === i ? np : pp))
          onDraftPointsChangeRef.current?.(next)
        })
        marker.on("dblclick", () => {
          onDraftPointsChangeRef.current?.(cleanDraft.filter((_, j) => j !== i))
        })
        marker.setMap(map)
        overlaysRef.current.push(marker)
      })
    }

    // 编辑模式：编辑折线 + 可拖拽标记
    if (editing) {
      if (editLine.length >= 2) {
        addCasedPolyline(editLine, "#f59e0b", 7, 0.95)
      }
      cleanEdit.forEach((p, i) => {
        // 途径站点：菱形标记
        if (editStops[i]) {
          const stopMarker = new AMap.Marker({
            position: p,
            offset: new AMap.Pixel(-9, -9),
            content: stopMarkerHtml("#f59e0b"),
          })
          stopMarker.setMap(map)
          overlaysRef.current.push(stopMarker)
        }
        const marker = new AMap.Marker({
          position: p,
          draggable: true,
          offset: new AMap.Pixel(-9, -9),
          content: pointMarkerHtml("#f59e0b", String(i + 1)),
        })
        marker.on("dragend", (...args: unknown[]) => {
          const e = args[0] as {
            target?: { getPosition?: () => { getLng(): number; getLat(): number } | null }
          }
          const pos = e?.target?.getPosition?.()
          if (!pos) return
          const np: [number, number] = [pos.getLng(), pos.getLat()]
          if (!Number.isFinite(np[0]) || !Number.isFinite(np[1])) return
          const next = cleanEdit.map((pp, j) => (j === i ? np : pp))
          onEditPointsChangeRef.current?.(next)
        })
        // 双击删除该点
        marker.on("dblclick", () => {
          onEditPointsChangeRef.current?.(cleanEdit.filter((_, j) => j !== i))
        })
        marker.setMap(map)
        overlaysRef.current.push(marker)
      })
    }

    // 绘制所有路线（编辑模式只显示正在编辑的路线）
    if (!editing) {
      routes.forEach((r) => {
        try {
          const points = r.points.filter(isValidPoint)
          if (points.length < 2) return
          // 贴路路径优先
          const drawPoints =
            r.path && r.path.length >= 2
              ? r.path.filter(isValidPoint)
              : points
          const selected = r.id === selectedRouteId
          const color = r.color ?? "#3b82f6"
          const selectRoute = () => onRouteClickRef.current?.(r.id)
          // 收集该路线的全部覆盖物（用于选中时聚焦）
          const routeOverlays: MapOverlay[] = []
          routeOverlayMapRef.current[r.id] = routeOverlays

          // 选中路线：外圈光晕
          if (selected) {
            const glow = new AMap.Polyline({
              path: drawPoints,
              strokeColor: color,
              strokeWeight: 15,
              strokeOpacity: 0.16,
              strokeStyle: "solid",
              lineJoin: "round",
              lineCap: "round",
            })
            glow.setMap(map)
            overlaysRef.current.push(glow)
            routeOverlays.push(glow)
          }

          // 描边 + 主色线（选中更粗更实），描边与主色线都可点击选中
          addCasedPolyline(
            drawPoints,
            color,
            selected ? 7 : 5,
            selected ? 1 : 0.85,
            onRouteClickRef.current ? selectRoute : undefined,
            routeOverlays
          )

          // 起点（实心圆 + 起）与终点（白色圆环 + 终）标记
          const startMarker = new AMap.Marker({
            position: drawPoints[0],
            offset: new AMap.Pixel(-9, -9),
            content: pointMarkerHtml(color, "起", 18),
          })
          const endMarker = new AMap.Marker({
            position: drawPoints[drawPoints.length - 1],
            offset: new AMap.Pixel(-9, -9),
            content: endMarkerHtml(color),
          })
          if (onRouteClickRef.current) {
            startMarker.on("click", selectRoute)
            endMarker.on("click", selectRoute)
          }
          startMarker.setMap(map)
          overlaysRef.current.push(startMarker)
          routeOverlays.push(startMarker)
          endMarker.setMap(map)
          overlaysRef.current.push(endMarker)
          routeOverlays.push(endMarker)

          // 途径站点：菱形标记（位于航点上）
          if (Array.isArray(r.stops)) {
            r.stops.forEach((s, i) => {
              const wp = points[i]
              if (!s || !wp) return
              const stopMarker = new AMap.Marker({
                position: wp,
                offset: new AMap.Pixel(-9, -9),
                content: stopMarkerHtml(color),
              })
              if (onRouteClickRef.current) {
                stopMarker.on("click", selectRoute)
              }
              stopMarker.setMap(map)
              overlaysRef.current.push(stopMarker)
              routeOverlays.push(stopMarker)
            })
          }
        } catch (e) {
          console.warn("[路线地图] 路线绘制失败:", r.name, e)
        }
      })
    }
  }, [routes, selectedRouteId, drawing, draftPoints, draftPath, editing, editPoints, editPath, editStops, resolvedTheme, ready, webglUsed, lightMap])

  // 视野跟随：选中路线 → 聚焦该路线；未选中 → 整体视图；绘制/编辑 → 适配全部覆盖物
  React.useEffect(() => {
    const entry = mapRef.current
    if (!entry) return
    const { instance: map } = entry
    if (!map) return

    try {
      if (drawing || editing) {
        // 绘制/编辑：适配全部覆盖物（草稿/编辑线 + 路线）
        map.setFitView(null, false, [50, 50, 50, 50])
        return
      }
      if (selectedRouteId != null) {
        const selectedRoute = routes.find((r) => r.id === selectedRouteId)
        const overlays = selectedRoute
          ? (routeOverlayMapRef.current[selectedRoute.id] ?? [])
          : []
        if (overlays.length > 0) {
          // 聚焦选中路线（路径 + 起/终 + 站点标记）
          map.setFitView(overlays, false, [60, 60, 60, 60])
          return
        }
      }
      // 整体视图
      map.setFitView(null, false, [50, 50, 50, 50])
    } catch {
      // 忽略无效视野
    }
  }, [routes, selectedRouteId, drawing, editing, draftPoints, ready])

  // 整体视图：适配全部路线
  function fitAllRoutes() {
    const entry = mapRef.current
    if (!entry) return
    try {
      entry.instance.setFitView(null, false, [50, 50, 50, 50])
    } catch {
      // 忽略无效视野
    }
  }

  return (
    // isolate 隔离内部层叠（防止地图标记/箭头飘到相邻面板上方拦截点击）；overflow-hidden 裁剪越界覆盖物
    <div className="relative isolate size-full overflow-hidden">
      <div ref={containerRef} className="size-full" />
      {/* 整体视图按钮（预览模式） */}
      {ready && !error && !drawing && !editing && (
        <Button
          variant="outline"
          size="sm"
          onClick={fitAllRoutes}
          title="适配全部路线"
          className={cn(
            "absolute right-3 top-3 z-20 gap-1",
            // WebGL 不可用（地图强制亮色）时：按钮使用亮色配置，! 覆盖 outline 变体的暗色半透明背景
            lightMap
              ? "border-neutral-300 bg-white! text-black hover:bg-black! hover:text-white!"
              : ""
          )}
        >
          <MaximizeIcon className="size-3.5" />
          整体视图
        </Button>
      )}
      {!ready && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/50">
          <p className="text-xs text-muted-foreground/40">地图加载中…</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className={cn("text-xs text-muted-foreground/40")}>地图加载失败: {error}</p>
        </div>
      )}
    </div>
  )
}
