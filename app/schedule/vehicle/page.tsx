"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { toast } from "sonner"
import {
  carsGetAllPositions,
  carsSetStatus,
  carsRunDemo,
  CtlCode,
  type CarPosition,
} from "@/lib/api"
import { getRoutes, type Route } from "@/lib/routes"
import {
  getRouteAssignments,
  setRouteAssignment,
} from "@/lib/route-assignments"
import { MonitorPreviewCard } from "@/components/monitor-preview-card"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CarIcon,
  GaugeIcon,
  MapPinIcon,
  NavigationIcon,
  ChevronLeftIcon,
  RouteIcon,
  RouteOffIcon,
  ExternalLinkIcon,
  BatteryIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { batteryDotClass, batteryDotGlow } from "@/lib/battery"
import { ON_ROUTE_THRESHOLD, projectToPath } from "@/lib/route-geometry"
import { InfoRow } from "@/components/info-row"

const ScheduleMap = dynamic(
  () => import("@/components/schedule-map").then((m) => m.ScheduleMap),
  { ssr: false, loading: () => <MapLoading /> }
)

function MapLoading() {
  return (
    <div className="flex size-full items-center justify-center">
      <p className="text-xs text-muted-foreground/40">地图加载中…</p>
    </div>
  )
}

export default function VehicleSchedulePage() {
  const [vehicles, setVehicles] = React.useState<CarPosition[]>([])
  const [selected, setSelected] = React.useState<CarPosition | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [startMode, setStartMode] = React.useState<"start" | "current">("start")
  const [routes] = React.useState<Route[]>(() => getRoutes())
  const [assignments, setAssignments] = React.useState<Record<number, number>>(
    () => getRouteAssignments()
  )

  // 选中车辆/取消选中：切换时重置循迹起始方式
  function handleSelect(vehicle: CarPosition | null) {
    setStartMode("start")
    setSelected(vehicle)
  }

  // 设置/清除车辆路线
  function handleRouteChange(vehicleId: number, routeId: number | null) {
    setRouteAssignment(vehicleId, routeId)
    setAssignments(getRouteAssignments())
    toast.success(routeId ? "已设置执行路线" : "已清除执行路线")
  }

  // 选中车辆正在执行的路线
  const selectedRoute = selected
    ? (routes.find((r) => r.id === assignments[selected.car_id]) ?? null)
    : null

  // 选中车辆是否仍在线（仍在最新位置列表里）
  const selectedOnline = selected
    ? vehicles.some((v) => v.car_id === selected.car_id)
    : false

  // 轮询车辆位置
  React.useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await carsGetAllPositions()
        if (!cancelled) {
          const data = (res.data as Record<string, CarPosition>) ?? {}
          const list = Object.values(data).filter((v) => v.kind !== "robot")
          setVehicles(list)
          // 同步更新选中车辆：若选中车辆仍在列表中，刷新其实时数据
          setSelected((prev) => {
            if (!prev) return prev
            const updated = list.find((v) => v.car_id === prev.car_id)
            return updated ?? prev
          })
        }
      } catch { /* ignore */ }
    }
    poll()
    const t = setInterval(poll, 1000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  // 发送控制指令
  async function sendCommand(code: CtlCode, label: string) {
    if (!selected) return
    setBusy(true)
    try {
      await carsSetStatus(selected.car_id, code)
      toast.success(`车辆 #${selected.car_id}: ${label}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "指令发送失败")
    } finally {
      setBusy(false)
    }
  }

  // 循迹导航：沿分配的执行路线开始行驶（taskId 即路线 id）
  async function handleTrack() {
    if (!selected || !selectedRoute) return
    setBusy(true)
    try {
      await carsRunDemo(selectedRoute.id, selected.car_id)
      toast.success(
        startMode === "current"
          ? `车辆 #${selected.car_id} 已从当前位置开始循迹「${selectedRoute.name}」`
          : `车辆 #${selected.car_id} 已导航到起点并开始循迹「${selectedRoute.name}」`
      )
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "循迹指令发送失败")
    } finally {
      setBusy(false)
    }
  }

  const commands = [
    { code: CtlCode.ACTIVATE, label: "启动", variant: "default" as const },
    { code: CtlCode.PAUSE, label: "暂停", variant: "secondary" as const },
    { code: CtlCode.CONTINUE, label: "继续", variant: "secondary" as const },
    { code: CtlCode.CANCEL, label: "取消任务", variant: "destructive" as const },
    { code: CtlCode.INACTIVATE, label: "休眠", variant: "ghost" as const },
  ]

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
        <h1 className="text-sm font-medium">车辆调度</h1>
        <span className="text-xs text-muted-foreground/40">
          在线 {vehicles.length} 辆
        </span>
      </div>

      {/* 地图 + 右侧面板 */}
      <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[3fr_1fr]" style={{ minHeight: 0 }}>
        {/* 地图 */}
        <Card className="flex flex-col" style={{ minHeight: 0 }}>
          <CardContent className="relative flex-1 p-0!" style={{ minHeight: 0 }}>
            <ScheduleMap
              vehicles={vehicles}
              onSelect={handleSelect}
              selectedId={selected?.car_id}
              assignedRoute={selectedRoute}
              startMode={startMode}
              onStartModeChange={setStartMode}
            />
          </CardContent>
        </Card>

        {/* 右侧面板：列表 或 详情 */}
        <div className="flex flex-col gap-5" style={{ minHeight: 0 }}>
          {selected ? (
            <VehicleDetail
              vehicle={selected}
              busy={busy}
              commands={commands}
              onCommand={sendCommand}
              onBack={() => handleSelect(null)}
              routes={routes}
              assignedRouteId={assignments[selected.car_id] ?? null}
              onRouteChange={handleRouteChange}
              onTrack={handleTrack}
              online={selectedOnline}
              startMode={startMode}
              onStartModeChange={setStartMode}
            />
          ) : (
            <VehicleList vehicles={vehicles} onSelect={handleSelect} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ==================== Vehicle List ==================== */

function VehicleList({
  vehicles,
  onSelect,
}: {
  vehicles: CarPosition[]
  onSelect: (v: CarPosition) => void
}) {
  return (
    <Card className="flex flex-1 flex-col" size="sm" style={{ minHeight: 0 }}>
      <CardHeader className="shrink-0 flex-row items-center justify-between border-b">
        <CardTitle className="text-xs">车辆列表</CardTitle>
        <Badge variant="secondary" className="text-[10px]">
          {vehicles.length} 辆
        </Badge>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto py-2" style={{ minHeight: 0 }}>
        {vehicles.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-12">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted/20 ring-1 ring-border/10">
              <CarIcon className="size-5 text-muted-foreground/20" />
            </div>
            <p className="text-xs text-muted-foreground/50">暂无车辆连接</p>
            <p className="text-[10px] text-muted-foreground/30">等待 ROS 节点上报位置</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {vehicles.map((v) => (
              <VehicleRow key={v.car_id} vehicle={v} onClick={() => onSelect(v)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function VehicleRow({
  vehicle,
  onClick,
}: {
  vehicle: CarPosition
  onClick: () => void
}) {
  const alive = vehicle.speed > 0
  const dotClass = batteryDotClass(vehicle.battery, alive)
  const dotGlow = batteryDotGlow(vehicle.battery, alive)
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg border border-border/10 bg-muted/10 p-2.5 text-left transition-all hover:border-border/25 hover:bg-muted/20 active:scale-[0.99]"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full ring-1 ring-offset-1 ring-offset-card",
            dotClass
          )}
          style={dotGlow ? { boxShadow: dotGlow } : undefined}
        />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">
            <span className="text-muted-foreground/40">#</span>
            {vehicle.car_id}
          </p>
          <p className="truncate font-mono text-[11px] text-muted-foreground/40 tabular-nums">
            {vehicle.x.toFixed(4)}, {vehicle.y.toFixed(4)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/40">
          {vehicle.speed.toFixed(2)} m/s
        </span>
        <Badge variant={alive ? "default" : "secondary"} className="text-[10px]">
          {alive ? "运行" : "待机"}
        </Badge>
        <ArrowRightIcon className="size-3 text-muted-foreground/20" />
      </div>
    </button>
  )
}

/* ==================== Vehicle Detail ==================== */

function VehicleDetail({
  vehicle,
  busy,
  commands,
  onCommand,
  onBack,
  routes,
  assignedRouteId,
  onRouteChange,
  onTrack,
  online,
  startMode,
  onStartModeChange,
}: {
  vehicle: CarPosition
  busy: boolean
  commands: { code: CtlCode; label: string; variant: "default" | "secondary" | "destructive" | "ghost" }[]
  onCommand: (code: CtlCode, label: string) => void
  onBack: () => void
  routes: Route[]
  assignedRouteId: number | null
  onRouteChange: (vehicleId: number, routeId: number | null) => void
  onTrack: () => void
  online: boolean
  startMode: "start" | "current"
  onStartModeChange: (mode: "start" | "current") => void
}) {
  const assignedRoute = routes.find((r) => r.id === assignedRouteId) ?? null

  // 是否已在执行路线上（用于决定是否提供“从当前位置开始”选项）
  const onRoute = React.useMemo(() => {
    if (!assignedRoute) return false
    const path =
      assignedRoute.path && assignedRoute.path.length >= 2
        ? assignedRoute.path
        : assignedRoute.points
    const clean = path.filter(
      (p) => Number.isFinite(p[0]) && Number.isFinite(p[1])
    )
    if (clean.length < 2) return false
    return (
      projectToPath(clean, [vehicle.x, vehicle.y]).distance <=
      ON_ROUTE_THRESHOLD
    )
  }, [assignedRoute, vehicle])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto" style={{ minHeight: 0 }}>
      {/* 车辆信息 */}
      <Card size="sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="flex size-5 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeftIcon className="size-3.5" />
            </button>
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="flex size-2 rounded-full bg-primary shadow-[0_0_6px_var(--color-primary)]" />
              车辆 #{vehicle.car_id}
            </CardTitle>
          </div>
          <CardDescription>实时数据</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          <InfoRow icon={MapPinIcon} label="坐标">
            ({vehicle.x.toFixed(5)}, {vehicle.y.toFixed(5)})
          </InfoRow>
          <InfoRow icon={GaugeIcon} label="速度">
            {vehicle.speed.toFixed(2)} m/s
          </InfoRow>
          {vehicle.battery != null && (
            <InfoRow icon={BatteryIcon} label="电量">
              <span className={vehicle.battery <= 20 ? "text-destructive" : undefined}>
                {vehicle.battery}%
              </span>
            </InfoRow>
          )}
          {vehicle.angle != null && (
            <InfoRow icon={NavigationIcon} label="朝向">
              {vehicle.angle.toFixed(1)}°
            </InfoRow>
          )}
          {vehicle.update_time && (
            <InfoRow icon={CarIcon} label="更新">
              {vehicle.update_time}
            </InfoRow>
          )}
        </CardContent>
      </Card>

      <MonitorPreviewCard kind="vehicle" carId={vehicle.car_id} online={online} />

      {/* 执行路线 */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <RouteIcon className="size-4 text-primary" />
            执行路线
          </CardTitle>
          <CardDescription>分配后车辆将沿路线行驶</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Select
            value={assignedRouteId ? String(assignedRouteId) : "none"}
            onValueChange={(v) => {
              onRouteChange(vehicle.car_id, v === "none" ? null : Number(v))
            }}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                <SelectLabel>执行路线</SelectLabel>
                <SelectItem value="none">
                  <RouteOffIcon className="size-3.5" />
                  未分配路线
                </SelectItem>
                {routes.length > 0 && <SelectSeparator />}
                {routes.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: r.color ?? "#3b82f6" }}
                    />
                    {r.name}（{r.points.length} 点）
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Link
            href="/schedule/routes"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50 transition-colors hover:text-foreground"
          >
            <ExternalLinkIcon className="size-3" />
            管理路线
          </Link>
          {assignedRoute && onRoute && (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant={startMode === "start" ? "default" : "secondary"}
                className="flex-1"
                onClick={() => onStartModeChange("start")}
              >
                从起点开始
              </Button>
              <Button
                size="sm"
                variant={startMode === "current" ? "default" : "secondary"}
                className="flex-1"
                onClick={() => onStartModeChange("current")}
              >
                从当前位置开始
              </Button>
            </div>
          )}
          {assignedRoute && (
            <Button
              size="sm"
              className="w-full"
              disabled={busy}
              onClick={onTrack}
            >
              <NavigationIcon data-icon="inline-start" />
              {startMode === "current"
                ? `从当前位置开始循迹：${assignedRoute.name}`
                : `导航到起点并循迹：${assignedRoute.name}`}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 控制命令 */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">控制命令</CardTitle>
          <CardDescription>发送车辆调度指令</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {commands.map((cmd) => (
            <Button
              key={cmd.code}
              variant={cmd.variant}
              size="sm"
              className="w-full justify-start"
              disabled={busy}
              onClick={() => onCommand(cmd.code, cmd.label)}
            >
              {cmd.label}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}


