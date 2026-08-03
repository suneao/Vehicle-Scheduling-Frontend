"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { toast } from "sonner"
import {
  carsGetAllPositions,
  carsSetStatus,
  CtlCode,
  type CarPosition,
} from "@/lib/api"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  BotIcon,
  GaugeIcon,
  MapPinIcon,
  NavigationIcon,
  RouteIcon,
  PlayIcon,
  PauseIcon,
  SquareIcon,
  RefreshCwIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

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

export default function PatrolSchedulePage() {
  const [robots, setRobots] = React.useState<CarPosition[]>([])
  const [selected, setSelected] = React.useState<CarPosition | null>(null)
  const [busy, setBusy] = React.useState(false)

  // 轮询机器狗位置
  React.useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await carsGetAllPositions()
        if (!cancelled) {
          const data = (res.data as Record<string, CarPosition>) ?? {}
          setRobots(Object.values(data))
        }
      } catch { /* ignore */ }
    }
    poll()
    const t = setInterval(poll, 1000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  async function sendCommand(code: CtlCode, label: string) {
    if (!selected) return
    setBusy(true)
    try {
      await carsSetStatus(selected.car_id, code)
      toast.success(`机器狗 #${selected.car_id}: ${label}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "指令发送失败")
    } finally {
      setBusy(false)
    }
  }

  const commands = [
    { code: CtlCode.ACTIVATE, label: "启动巡逻", variant: "default" as const, icon: PlayIcon },
    { code: CtlCode.PAUSE, label: "暂停", variant: "secondary" as const, icon: PauseIcon },
    { code: CtlCode.CONTINUE, label: "继续", variant: "secondary" as const, icon: RefreshCwIcon },
    { code: CtlCode.CANCEL, label: "停止巡逻", variant: "destructive" as const, icon: SquareIcon },
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
        <h1 className="text-sm font-medium">机器狗巡逻调度</h1>
        <span className="text-xs text-muted-foreground/40">
          在线 {robots.length} 台
        </span>
      </div>

      {/* 地图 + 右侧面板 */}
      <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[3fr_1fr]" style={{ minHeight: 0 }}>
        {/* 地图 */}
        <Card className="flex flex-col" style={{ minHeight: 0 }}>
          <CardContent className="flex-1 p-0!" style={{ minHeight: 0 }}>
            <ScheduleMap
              vehicles={robots}
              onSelect={setSelected}
              selectedId={selected?.car_id}
            />
          </CardContent>
        </Card>

        {/* 右侧面板 */}
        <div className="flex flex-col gap-5" style={{ minHeight: 0 }}>
          {/* 巡逻路线 */}
          <RouteCard />

          {/* 机器狗列表 / 详情 */}
          {selected ? (
            <RobotDetail
              robot={selected}
              busy={busy}
              commands={commands}
              onCommand={sendCommand}
              onBack={() => setSelected(null)}
            />
          ) : (
            <RobotList robots={robots} onSelect={setSelected} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ==================== Route Card ==================== */

function RouteCard() {
  return (
    <Card size="sm" className="shrink-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <RouteIcon className="size-4 text-primary" />
          巡逻路线
        </CardTitle>
        <CardDescription>已配置的巡逻路线</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted/20 ring-1 ring-border/10">
            <RouteIcon className="size-6 text-muted-foreground/15" />
          </div>
          <p className="text-xs text-muted-foreground/50">暂无巡逻路线</p>
          <p className="text-[10px] text-muted-foreground/30">
            请在高德地图上绘制巡逻路线
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/* ==================== Robot List ==================== */

function RobotList({
  robots,
  onSelect,
}: {
  robots: CarPosition[]
  onSelect: (v: CarPosition) => void
}) {
  return (
    <Card className="flex flex-1 flex-col" size="sm" style={{ minHeight: 0 }}>
      <CardHeader className="shrink-0 flex-row items-center justify-between border-b">
        <CardTitle className="flex items-center gap-2 text-xs">
          <BotIcon className="size-3.5 text-primary" />
          机器狗列表
        </CardTitle>
        <Badge variant="secondary" className="text-[10px]">
          {robots.length} 台
        </Badge>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto py-2" style={{ minHeight: 0 }}>
        {robots.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-12">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted/20 ring-1 ring-border/10">
              <BotIcon className="size-5 text-muted-foreground/20" />
            </div>
            <p className="text-xs text-muted-foreground/50">暂无机器狗连接</p>
            <p className="text-[10px] text-muted-foreground/30">等待 ROS 节点上报位置</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {robots.map((r) => (
              <RobotRow key={r.car_id} robot={r} onClick={() => onSelect(r)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RobotRow({
  robot,
  onClick,
}: {
  robot: CarPosition
  onClick: () => void
}) {
  const alive = robot.speed > 0
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg border border-border/10 bg-muted/10 p-2.5 text-left transition-all hover:border-border/25 hover:bg-muted/20 active:scale-[0.99]"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full ring-1 ring-offset-1 ring-offset-card",
            alive ? "bg-primary ring-primary/30" : "bg-muted-foreground/30 ring-transparent"
          )}
          style={alive ? { boxShadow: "0 0 8px var(--color-primary)" } : undefined}
        />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">
            <span className="text-muted-foreground/40">#</span>
            {robot.car_id}
          </p>
          <p className="truncate font-mono text-[11px] text-muted-foreground/40 tabular-nums">
            {robot.x.toFixed(1)}, {robot.y.toFixed(1)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/40">
          {robot.speed.toFixed(1)} m/s
        </span>
        <Badge variant={alive ? "default" : "secondary"} className="text-[10px]">
          {alive ? "巡逻中" : "待机"}
        </Badge>
        <ArrowRightIcon className="size-3 text-muted-foreground/20" />
      </div>
    </button>
  )
}

/* ==================== Robot Detail ==================== */

function RobotDetail({
  robot,
  busy,
  commands,
  onCommand,
  onBack,
}: {
  robot: CarPosition
  busy: boolean
  commands: { code: CtlCode; label: string; variant: "default" | "secondary" | "destructive" | "ghost"; icon?: React.ComponentType<{ className?: string }> }[]
  onCommand: (code: CtlCode, label: string) => void
  onBack: () => void
}) {
  return (
    <div className="flex flex-col gap-5" style={{ minHeight: 0 }}>
      {/* 机器狗信息 */}
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
              机器狗 #{robot.car_id}
            </CardTitle>
          </div>
          <CardDescription>实时数据</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          <InfoRow icon={MapPinIcon} label="坐标">
            ({robot.x.toFixed(2)}, {robot.y.toFixed(2)})
          </InfoRow>
          <InfoRow icon={GaugeIcon} label="速度">
            {robot.speed.toFixed(2)} m/s
          </InfoRow>
          {robot.angle != null && (
            <InfoRow icon={NavigationIcon} label="朝向">
              {robot.angle.toFixed(1)}°
            </InfoRow>
          )}
          {robot.update_time && (
            <InfoRow icon={BotIcon} label="更新">
              {robot.update_time}
            </InfoRow>
          )}
        </CardContent>
      </Card>

      {/* 控制命令 */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">控制命令</CardTitle>
          <CardDescription>发送巡逻控制指令</CardDescription>
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
              {cmd.icon && <cmd.icon data-icon="inline-start" />}
              {cmd.label}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

/* ==================== Info Row ==================== */

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <Icon className="size-3.5 shrink-0 text-muted-foreground/40" />
      <span className="w-10 shrink-0 text-muted-foreground/50">{label}</span>
      <span className="font-mono tabular-nums text-foreground/80">{children}</span>
    </div>
  )
}
