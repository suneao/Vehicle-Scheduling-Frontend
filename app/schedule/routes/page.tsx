"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { toast } from "sonner"
import {
  getRoutes,
  loadRoutes,
  addRoute,
  updateRoute,
  deleteRoute,
  type Route,
  type RouteStop,
} from "@/lib/routes"
import { eventUsesRoute } from "@/lib/events"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  CheckIcon,
  XIcon,
  RouteIcon,
  MousePointerClickIcon,
  NavigationIcon,
  SplineIcon,
  MapPinIcon,
  ClockIcon,
  WaypointsIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

const RouteMap = dynamic(
  () => import("@/components/route-map").then((m) => m.RouteMap),
  { ssr: false, loading: () => <MapLoading /> }
)

function MapLoading() {
  return (
    <div className="flex size-full items-center justify-center">
      <p className="text-xs text-muted-foreground/40">地图加载中…</p>
    </div>
  )
}

export default function RoutesPage() {
  const [routes, setRoutes] = React.useState<Route[]>([])
  const [selectedId, setSelectedId] = React.useState<number | null>(null)

  // 绘制状态
  const [drawing, setDrawing] = React.useState(false)
  const [draftName, setDraftName] = React.useState("")
  const [draftPoints, setDraftPoints] = React.useState<[number, number][]>([])
  // 草稿贴路路径（高德驾车规划）：{ path, src }，src 为产生该路径的航点快照
  const [draftRoad, setDraftRoad] = React.useState<{
    path: [number, number][]
    src: [number, number][]
  } | null>(null)

  // 编辑状态
  const [editing, setEditing] = React.useState(false)
  const [editName, setEditName] = React.useState("")
  const [editPoints, setEditPoints] = React.useState<[number, number][]>([])
  const [editRoad, setEditRoad] = React.useState<{
    path: [number, number][]
    src: [number, number][]
  } | null>(null)

  // 路径生成模式：road = 高德驾车贴路；curve = 贝塞尔曲线；polyline = 直线折线
  const [pathMode, setPathMode] = React.useState<
    "road" | "curve" | "polyline"
  >("road")
  // 编辑中的途径站点（按 editPoints 索引对齐；null = 不停车直接通过）
  const [editStops, setEditStops] = React.useState<(RouteStop | null)[]>([])
  // 当前展开站点设置面板的航点索引
  const [stopEditIndex, setStopEditIndex] = React.useState<number | null>(null)

  const selected = routes.find((r) => r.id === selectedId) ?? null

  function refresh() {
    setRoutes(getRoutes())
  }

  // 首次挂载时从云端加载路线
  React.useEffect(() => {
    let cancelled = false
    loadRoutes().then((list) => {
      if (!cancelled) setRoutes(list)
    })
    return () => { cancelled = true }
  }, [])

  /** 点 p 在线段 ab 上的投影参数 t（t<0 在 a 端外，t>1 在 b 端外） */
  function projectParam(
    p: [number, number],
    a: [number, number],
    b: [number, number]
  ): number {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy
    if (len2 === 0) return 0
    return ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  }

  /** 点 p 到线段 ab 的距离（经纬度近似） */
  function distToSegment(
    p: [number, number],
    a: [number, number],
    b: [number, number]
  ): number {
    const t = Math.max(0, Math.min(1, projectParam(p, a, b)))
    return Math.hypot(
      p[0] - (a[0] + t * (b[0] - a[0])),
      p[1] - (a[1] + t * (b[1] - a[1]))
    )
  }

  /**
   * 点击地图增点：
   * - 点击首段且在起点之外 → 前置为新起点（延伸路线）
   * - 点击末段且在终点之外 → 追加为新终点（延伸路线）
   * - 其余情况 → 在最近线段上插入点（与前一个点之间）
   * 过近的重复点忽略。返回新数组与插入位置（index=-1 表示未插入）。
   */
  function insertNearestPoint(
    points: [number, number][],
    p: [number, number]
  ): { next: [number, number][]; index: number } {
    if (points.length < 2) return { next: [...points, p], index: points.length }
    if (points.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6))
      return { next: points, index: -1 }
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < points.length - 1; i++) {
      const d = distToSegment(p, points[i], points[i + 1])
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    const t = projectParam(p, points[best], points[best + 1])
    // 端点之外 → 延伸为新端点
    if (best === 0 && t < 0) return { next: [p, ...points], index: 0 }
    if (best === points.length - 2 && t > 1)
      return { next: [...points, p], index: points.length }
    // 线段内部 → 插入点
    return {
      next: [...points.slice(0, best + 1), p, ...points.slice(best + 1)],
      index: best + 1,
    }
  }

  // 地图点击：绘制模式收集点 / 编辑模式在最近线段插入点 / 预览模式选中最近路线（兜底）
  function handleMapClick(point: [number, number]) {
    // 拒绝非法坐标，防止 NaN 污染路线数据
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return
    if (drawing) {
      setDraftPoints((prev) => [...prev, point])
    } else if (editing && selected) {
      const { next, index } = insertNearestPoint(editPoints, point)
      if (index < 0) return
      setEditPoints(next)
      setEditStops((prev) => {
        const s = [...prev]
        s.splice(index, 0, null)
        return s
      })
      if (stopEditIndex != null && stopEditIndex >= index) {
        setStopEditIndex(stopEditIndex + 1)
      }
    } else if (!drawing && !editing) {
      // 预览模式：点击地图选中最近的路线（折线点击事件的兜底）
      const clicked: [number, number] = [point[0], point[1]]
      let best: Route | null = null
      let bestD = 1e-4 // 约 11 米内
      for (const r of routes) {
        const pts = (r.path && r.path.length >= 2 ? r.path : r.points).filter(
          (p) => Number.isFinite(p[0]) && Number.isFinite(p[1])
        )
        if (pts.length < 2) continue
        for (let i = 0; i < pts.length - 1; i++) {
          const d = distToSegment(clicked, pts[i], pts[i + 1])
          if (d < bestD) {
            bestD = d
            best = r
          }
        }
      }
      if (best) {
        setSelectedId(best.id)
        setEditing(false)
        setEditPoints([])
        setEditRoad(null)
      }
    }
  }

  // 删除编辑点（同时删除对应站点配置，保持对齐）
  function removeEditPoint(i: number) {
    setEditPoints((prev) => prev.filter((_, j) => j !== i))
    setEditStops((prev) => prev.filter((_, j) => j !== i))
    if (stopEditIndex === i) setStopEditIndex(null)
    else if (stopEditIndex != null && stopEditIndex > i) setStopEditIndex(stopEditIndex - 1)
  }

  // 地图编辑点变更：拖拽（同长度）直接更新；双击删除（变短）同步移除站点配置
  function handleEditPointsChange(next: [number, number][]) {
    if (next.length === editPoints.length) {
      setEditPoints(next)
      return
    }
    // 找出被删除的索引（前缀匹配后第一个不等的点）
    let removed = -1
    for (let i = 0; i < editPoints.length; i++) {
      if (
        i >= next.length ||
        editPoints[i][0] !== next[i][0] ||
        editPoints[i][1] !== next[i][1]
      ) {
        removed = i
        break
      }
    }
    if (removed < 0) removed = editPoints.length - 1
    setEditPoints(next)
    setEditStops((prev) => prev.filter((_, j) => j !== removed))
    if (stopEditIndex === removed) setStopEditIndex(null)
    else if (stopEditIndex != null && stopEditIndex > removed)
      setStopEditIndex(stopEditIndex - 1)
  }

  // 设置/取消某航点为站点
  function toggleStop(i: number) {
    const cur = editStops[i]
    const next = [...editStops]
    next[i] = cur ? null : { mode: "auto", waitSeconds: 30 }
    setEditStops(next)
    setStopEditIndex(cur ? null : i)
  }

  // 更新站点行为
  function updateStop(i: number, patch: Partial<RouteStop>) {
    setEditStops((prev) => {
      const next = [...prev]
      if (next[i]) next[i] = { ...next[i]!, ...patch }
      return next
    })
  }

  /** 贴路路径是否与当前航点匹配（避免保存到过期路径） */
  function matchRoad(
    road: { path: [number, number][]; src: [number, number][] } | null,
    points: [number, number][]
  ): [number, number][] | undefined {
    if (!road || road.path.length < 2) return undefined
    const s = road.src
    if (s.length !== points.length) return undefined
    for (let i = 0; i < s.length; i++) {
      if (s[i][0] !== points[i][0] || s[i][1] !== points[i][1]) return undefined
    }
    return road.path
  }

  // 切换路径模式：同时清除已解析路径，避免旧模式的路径被误存
  function changePathMode(v: "road" | "curve" | "polyline") {
    setPathMode(v)
    setDraftRoad(null)
    setEditRoad(null)
  }

  // 进入编辑模式
  function startEdit(r: Route) {
    setSelectedId(r.id)
    setEditing(true)
    setEditName(r.name)
    setEditPoints(r.points.map((p) => [p[0], p[1]] as [number, number]))
    setEditRoad(null)
    setStopEditIndex(null)
    // 同步站点配置（对齐 points 长度，缺省为 null）
    const stops = [...(Array.isArray(r.stops) ? r.stops : [])]
    while (stops.length < r.points.length) stops.push(null)
    setEditStops(stops)
    // 同步为路线自身的模式
    setPathMode(r.mode ?? "road")
  }

  // 取消编辑
  function cancelEdit() {
    setEditing(false)
    setEditPoints([])
    setEditRoad(null)
    setEditStops([])
    setStopEditIndex(null)
  }

  // 保存编辑后的路线（名称 + 航点 + 贴路路径）
  async function handleSaveEdit() {
    if (!selected) return
    const clean = editPoints.filter(
      (p) => Number.isFinite(p[0]) && Number.isFinite(p[1])
    )
    if (clean.length < 2) {
      toast.error("至少需要 2 个有效点")
      return
    }
    const path = matchRoad(editRoad, clean)
    const hasStops = editStops.some((s) => s != null)
    try {
      await updateRoute(selected.id, {
        name: editName.trim() || selected.name,
        points: clean,
        mode: pathMode,
        ...(path ? { path } : { path: undefined }),
        ...(hasStops ? { stops: editStops } : { stops: undefined }),
      })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "路线更新失败")
      return
    }
    toast.success(path ? "路线已更新（贴路）" : "路线已更新")
    setEditing(false)
    setEditPoints([])
    setEditRoad(null)
    setEditStops([])
    setStopEditIndex(null)
    refresh()
  }

  // 保存新路线
  async function handleSaveDraft() {
    const clean = draftPoints.filter(
      (p) => Number.isFinite(p[0]) && Number.isFinite(p[1])
    )
    if (clean.length < 2) {
      toast.error("至少需要 2 个有效点")
      return
    }
    const path = matchRoad(draftRoad, clean)
    try {
      await addRoute(draftName.trim(), clean, path, pathMode)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "路线保存失败")
      return
    }
    toast.success(path ? "路线已保存（贴路）" : "路线已保存")
    setDrawing(false)
    setDraftName("")
    setDraftPoints([])
    setDraftRoad(null)
    refresh()
  }

  // 删除路线
  async function handleDelete(id: number) {
    if (eventUsesRoute(id)) {
      toast.error("该路线被事件引用，无法删除")
      return
    }
    if (!confirm("确认删除该路线？")) return
    try {
      await deleteRoute(id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "路线删除失败")
      return
    }
    if (selectedId === id) {
      setSelectedId(null)
      setEditing(false)
      setEditPoints([])
      setEditRoad(null)
      setEditStops([])
      setStopEditIndex(null)
    }
    toast.success("路线已删除")
    refresh()
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      {/* 顶部导航 */}
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/schedule"
          className="inline-flex items-center gap-1 rounded-none px-2 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3" />
          调度中心
        </Link>
        <Separator orientation="vertical" className="h-4" />
        <h1 className="text-sm font-medium">路线编辑</h1>
        <span className="text-xs text-muted-foreground/40">共 {routes.length} 条路线</span>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[3fr_1fr]" style={{ minHeight: 0 }}>
        {/* 地图 */}
        <Card className="flex flex-col" style={{ minHeight: 0 }}>
          <CardHeader className="shrink-0 flex-row items-center justify-between border-b">
            <CardTitle className="flex items-center gap-2 text-xs">
              <RouteIcon className="size-3.5 text-primary" />
              {drawing ? "绘制路线" : editing && selected ? `编辑: ${selected.name}` : selected ? `预览: ${selected.name}` : "路线预览"}
            </CardTitle>
            <span className="text-[10px] text-muted-foreground/40">
              {drawing
                ? `${draftPoints.length} 个点 · 拖拽调整/双击删点`
                : editing
                  ? `${editPoints.length} 个点 · 拖拽/点击增点/双击删点`
                  : "点击路线可选中"}
            </span>
          </CardHeader>
          <CardContent className="relative flex-1 p-0!" style={{ minHeight: 0 }}>
            <RouteMap
              routes={routes}
              selectedRouteId={selectedId}
              drawing={drawing}
              draftPoints={draftPoints}
              draftPath={matchRoad(draftRoad, draftPoints) ?? []}
              onDraftPathChange={(path, src) => setDraftRoad({ path, src })}
              editing={editing && !!selected}
              editPoints={editPoints}
              editPath={matchRoad(editRoad, editPoints) ?? []}
              onEditPathChange={(path, src) => setEditRoad({ path, src })}
              onEditPointsChange={handleEditPointsChange}
              editStops={editStops}
              pathMode={pathMode}
              onMapClick={handleMapClick}
              onDraftPointsChange={setDraftPoints}
              onRouteClick={(id) => {
                setSelectedId(id)
                setEditing(false)
                setEditPoints([])
                setEditRoad(null)
              }}
            />
          </CardContent>
        </Card>

        {/* 右侧面板 */}
        <div className="relative z-10 flex flex-col gap-5" style={{ minHeight: 0 }}>
          {/* 绘制工具栏 */}
          {drawing ? (
            <Card size="sm">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-1.5 text-xs">
                  <MousePointerClickIcon className="size-3.5 text-primary" />
                  绘制中
                </CardTitle>
                <button
                  onClick={() => {
                    setDrawing(false)
                    setDraftPoints([])
                    setDraftRoad(null)
                  }}
                  className="flex size-5 items-center justify-center rounded text-muted-foreground/40 hover:bg-muted hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {/* 路径生成模式 */}
                <ToggleGroup
                  value={[pathMode]}
                  onValueChange={(values) => {
                    const v = values[0]
                    if (v === "road" || v === "curve" || v === "polyline")
                      changePathMode(v)
                  }}
                  variant="outline"
                  size="sm"
                  spacing={0}
                  className="w-full"
                >
                  <ToggleGroupItem value="road" className="flex-1 gap-1">
                    <NavigationIcon className="size-3.5" />
                    吸附道路
                  </ToggleGroupItem>
                  <ToggleGroupItem value="curve" className="flex-1 gap-1">
                    <SplineIcon className="size-3.5" />
                    贝塞尔曲线
                  </ToggleGroupItem>
                  <ToggleGroupItem value="polyline" className="flex-1 gap-1">
                    <WaypointsIcon className="size-3.5" />
                    折线
                  </ToggleGroupItem>
                </ToggleGroup>
                <p className="text-[10px] text-muted-foreground/50">
                  {pathMode === "road"
                    ? "路线将贴合高德道路（驾车规划）"
                    : pathMode === "curve"
                      ? "路线将通过航点生成平滑贝塞尔曲线"
                      : "路线将以直线连接航点"}
                  （{draftPoints.length} 个点）
                </p>
                <Input
                  placeholder="路线名称"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                />
                <Button size="sm" onClick={handleSaveDraft} disabled={draftPoints.length < 2}>
                  <CheckIcon data-icon="inline-start" />
                  保存路线
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 路线列表 */}
              <Card className="flex flex-1 flex-col" size="sm" style={{ minHeight: 0 }}>
                <CardHeader className="shrink-0 flex-row items-center justify-between border-b">
                  <CardTitle className="text-xs">路线列表</CardTitle>
                  <Button size="xs" onClick={() => { setDrawing(true); setDraftRoad(null); setEditing(false); setEditPoints([]); setEditRoad(null) }}>
                    <PlusIcon data-icon="inline-start" />
                    添加路线
                  </Button>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto py-2" style={{ minHeight: 0 }}>
                  {routes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12">
                      <RouteIcon className="size-6 text-muted-foreground/20" />
                      <p className="text-xs text-muted-foreground/50">暂无路线</p>
                      <p className="text-[10px] text-muted-foreground/30">点击“添加路线”开始绘制</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {routes.map((r) => (
                        <div
                          key={r.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelectedId(r.id)
                            setEditing(false)
                            setEditPoints([])
                            setEditRoad(null)
                          }}
                          className={cn(
                            "group flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs transition-colors select-none",
                            r.id === selectedId
                              ? "border-primary bg-primary/5"
                              : "border-border/10 hover:bg-muted/20"
                          )}
                        >
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: r.color ?? "#3b82f6" }}
                          />
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {r.name}
                            <span className="ml-1 text-[10px] text-muted-foreground/40">
                              {r.points.length} 点
                            </span>
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              startEdit(r)
                            }}
                            className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <PencilIcon className="size-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(r.id)
                            }}
                            className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-muted hover:text-destructive"
                          >
                            <Trash2Icon className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 选中路线详情/编辑 */}
              {selected && (
                <Card size="sm">
                  <CardHeader>
                    <CardTitle className="text-xs">路线信息</CardTitle>
                    <CardDescription>
                      {editing
                        ? `${editPoints.length} 个路径点 · 可编辑`
                        : `${selected.points.length} 个路径点 · 可编辑`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {/* 路径生成模式：编辑时可切换，查看时只读显示 */}
                    {editing ? (
                      <ToggleGroup
                        value={[pathMode]}
                        onValueChange={(values) => {
                          const v = values[0]
                          if (v === "road" || v === "curve" || v === "polyline")
                            changePathMode(v)
                        }}
                        variant="outline"
                        size="sm"
                        spacing={0}
                        className="w-full"
                      >
                        <ToggleGroupItem value="road" className="flex-1 gap-1">
                          <NavigationIcon className="size-3.5" />
                          吸附道路
                        </ToggleGroupItem>
                        <ToggleGroupItem value="curve" className="flex-1 gap-1">
                          <SplineIcon className="size-3.5" />
                          贝塞尔曲线
                        </ToggleGroupItem>
                        <ToggleGroupItem value="polyline" className="flex-1 gap-1">
                          <WaypointsIcon className="size-3.5" />
                          折线
                        </ToggleGroupItem>
                      </ToggleGroup>
                    ) : (
                      <div className="flex items-center gap-1.5 rounded-lg border border-border/10 bg-muted/10 px-2.5 py-2 text-[11px] text-muted-foreground/70">
                        {(selected.mode ?? "road") === "curve" ? (
                          <>
                            <SplineIcon className="size-3.5 text-primary" />
                            贝塞尔曲线模式
                          </>
                        ) : (selected.mode ?? "road") === "polyline" ? (
                          <>
                            <WaypointsIcon className="size-3.5 text-primary" />
                            折线模式
                          </>
                        ) : (
                          <>
                            <NavigationIcon className="size-3.5 text-primary" />
                            吸附道路模式
                          </>
                        )}
                      </div>
                    )}
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={selected.name}
                      disabled={!editing}
                    />
                    {editing ? (
                      <>
                        {/* 路径点列表 */}
                        <div className="flex max-h-44 flex-col gap-1 overflow-auto">
                          {editPoints.length === 0 && (
                            <p className="py-2 text-center text-[10px] text-muted-foreground/40">
                              暂无路径点，请在地图上点击添加
                            </p>
                          )}
                          {editPoints.map((p, i) => {
                            const stop = editStops[i]
                            return (
                              <div
                                key={i}
                                className={cn(
                                  "flex items-center gap-2 rounded-lg border px-2.5 py-1.5",
                                  stop
                                    ? "border-primary/30 bg-primary/5"
                                    : "border-border/10 bg-muted/10"
                                )}
                              >
                                <span className="w-5 shrink-0 text-center font-mono text-[10px] text-muted-foreground/40">
                                  {i + 1}
                                </span>
                                <span className="min-w-0 flex-1 truncate font-mono text-[10px] tabular-nums text-foreground/70">
                                  {p[0].toFixed(5)}, {p[1].toFixed(5)}
                                </span>
                                {stop && (
                                  <span className="flex shrink-0 items-center gap-0.5 rounded bg-primary/10 px-1 py-0.5 font-mono text-[9px] text-primary">
                                    <MapPinIcon className="size-2.5" />
                                    {stop.mode === "auto"
                                      ? `${stop.waitSeconds}s`
                                      : "手动"}
                                  </span>
                                )}
                                <button
                                  onClick={() => toggleStop(i)}
                                  title={stop ? "取消站点" : "设为站点"}
                                  className={cn(
                                    "flex size-5 shrink-0 items-center justify-center rounded transition-colors",
                                    stop
                                      ? "text-primary hover:bg-primary/10"
                                      : "text-muted-foreground/40 hover:bg-muted hover:text-foreground"
                                  )}
                                >
                                  <MapPinIcon className="size-3.5" />
                                </button>
                                <button
                                  onClick={() => removeEditPoint(i)}
                                  className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/40 hover:bg-muted hover:text-destructive"
                                >
                                  <Trash2Icon className="size-3" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                        {/* 站点行为设置 */}
                        {stopEditIndex != null && editStops[stopEditIndex] && (
                          <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                            <div className="flex items-center justify-between">
                              <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                                <MapPinIcon className="size-3 text-primary" />
                                第 {stopEditIndex + 1} 点 · 站点行为
                              </p>
                              <button
                                onClick={() => setStopEditIndex(null)}
                                className="flex size-4 items-center justify-center rounded text-muted-foreground/40 hover:bg-muted hover:text-foreground"
                              >
                                <XIcon className="size-3" />
                              </button>
                            </div>
                            <ToggleGroup
                              value={[editStops[stopEditIndex].mode]}
                              onValueChange={(values) => {
                                const v = values[0]
                                if (v === "auto" || v === "manual")
                                  updateStop(stopEditIndex, { mode: v })
                              }}
                              variant="outline"
                              size="sm"
                              spacing={0}
                              className="w-full"
                            >
                              <ToggleGroupItem value="auto" className="flex-1 gap-1">
                                <ClockIcon className="size-3.5" />
                                到站自动发车
                              </ToggleGroupItem>
                              <ToggleGroupItem value="manual" className="flex-1 gap-1">
                                <MapPinIcon className="size-3.5" />
                                手动发车
                              </ToggleGroupItem>
                            </ToggleGroup>
                            {editStops[stopEditIndex].mode === "auto" && (
                              <div className="flex items-center gap-2">
                                <span className="shrink-0 text-[10px] text-muted-foreground/60">
                                  等待
                                </span>
                                <Input
                                  type="number"
                                  min={0}
                                  value={editStops[stopEditIndex].waitSeconds}
                                  onChange={(e) =>
                                    updateStop(stopEditIndex, {
                                      waitSeconds: Math.max(
                                        0,
                                        Math.round(Number(e.target.value) || 0)
                                      ),
                                    })
                                  }
                                  className="h-7 w-16"
                                />
                                <span className="shrink-0 text-[10px] text-muted-foreground/60">
                                  秒后自动发车
                                </span>
                              </div>
                            )}
                            <p className="text-[9px] text-muted-foreground/40">
                              自动：车辆到站停车，等待设定时间后自动继续行驶；手动：到站停车，等待人工发送“继续”指令发车。
                            </p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={handleSaveEdit}
                          >
                            <CheckIcon data-icon="inline-start" />
                            保存
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                          >
                            <XIcon data-icon="inline-start" />
                            取消
                          </Button>
                        </div>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(selected)}
                      >
                        <PencilIcon data-icon="inline-start" />
                        编辑路线
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
