"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import {
  carsGetAllPositions,
  type CarPosition,
} from "@/lib/api"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/components/auth-provider"
import { cn } from "@/lib/utils"

const MapView = dynamic(() => import("@/components/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center">
      <p className="text-xs text-muted-foreground/40">地图加载中…</p>
    </div>
  ),
})
import {
  CarIcon,
  GaugeIcon,
  ActivityIcon,
  ClockIcon,
  CircleIcon,
  MapIcon,
  ZapIcon,
} from "lucide-react"

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [positions, setPositions] = React.useState<Record<string, CarPosition>>({})
  const [lastUpdate, setLastUpdate] = React.useState("")
  const [logs, setLogs] = React.useState<{ time: string; text: string; type: "info" | "warn" | "error" }[]>([])
  const [logFull, setLogFull] = React.useState(false)
  const [uptime, setUptime] = React.useState(0)

  // 鉴权守卫：未登录跳转登录页
  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login")
    }
  }, [authLoading, isAuthenticated, router])

  React.useEffect(() => {
    let cancelled = false
    const start = Date.now()

    function addLog(text: string, type: "info" | "warn" | "error" = "info") {
      setLogs((prev) => {
        const next = [
          { time: new Date().toLocaleTimeString("zh-CN"), text, type },
          ...prev.slice(0, 49),
        ]
        setLogFull(next.length >= 50)
        return next
      })
    }

    async function fetchPositions() {
      try {
        const res = await carsGetAllPositions().catch(() => null)
        if (cancelled) return

        const newPositions = (res?.data as Record<string, CarPosition>) || {}
        const oldCount = Object.keys(positions).length
        const newCount = Object.keys(newPositions).length
        if (newCount !== oldCount && newCount > 0) {
          addLog(`车辆数量变更: ${oldCount} → ${newCount}`)
        }

        setPositions(newPositions)
        setLastUpdate(new Date().toLocaleTimeString("zh-CN"))
      } catch {
        addLog("数据获取失败，将在下次轮询重试", "warn")
      }
    }

    fetchPositions()
    addLog("系统启动，开始监控")
    const interval = setInterval(fetchPositions, 500)
    const uptimeTimer = setInterval(() => {
      if (!cancelled) setUptime(Math.floor((Date.now() - start) / 1000))
    }, 1000)

    return () => {
      cancelled = true
      clearInterval(interval)
      clearInterval(uptimeTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const carList = Object.values(positions)
  const totalCars = carList.length
  const movingCars = carList.filter((c) => c.speed > 0).length
  const avgSpeed = totalCars > 0 ? carList.reduce((sum, c) => sum + c.speed, 0) / totalCars : 0

  const h = Math.floor(uptime / 3600)
  const m = Math.floor((uptime % 3600) / 60)
  const s = uptime % 60
  const uptimeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`

  return (
    <div className="flex min-h-full flex-col gap-5">
      {/* ===== 统计卡片 ===== */}
      <div className="grid shrink-0 grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={CarIcon}
          label="车辆总数"
          value={totalCars}
          unit="辆"
          description={`${movingCars} 辆运行中`}
        />
        <StatCard
          icon={ZapIcon}
          label="活跃车辆"
          value={movingCars}
          unit="辆"
          description="实时移动中"
          tone={movingCars > 0 ? "brand" : "muted"}
        />
        <StatCard
          icon={GaugeIcon}
          label="平均速度"
          value={avgSpeed.toFixed(2)}
          unit="m/s"
          description="车队均值"
        />
        <StatCard
          icon={ActivityIcon}
          label="运行时长"
          value={uptimeStr}
          unit=""
          description="自启动起"
        />
      </div>

      {/* ===== 地图 + 车辆列表 ===== */}
      <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[3fr_1fr]" style={{ minHeight: "300px" }}>
        {/* 地图 */}
        <Card className="flex flex-col" style={{ minHeight: 0 }}>
          <CardHeader className="shrink-0 flex-row items-center justify-between border-b">
            <div className="flex items-center gap-2">
              <span className="flex size-2 rounded-full bg-primary" />
              <CardTitle className="text-xs">全局监控视图</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <MapIcon className="size-3 text-muted-foreground/40" />
              <span className="font-mono text-[11px] tracking-wider text-muted-foreground/40">LIVE</span>
            </div>
          </CardHeader>
          <CardContent className="relative flex flex-1" style={{ minHeight: 0 }}>
            <MapView vehicles={carList} />
          </CardContent>
        </Card>

        {/* 车辆状态 */}
        <Card className="flex flex-col" style={{ minHeight: 0 }}>
          <CardHeader className="shrink-0 flex-row items-center justify-between border-b">
            <CardTitle className="text-xs">车辆状态</CardTitle>
            <div className="flex items-center gap-2">
              <span className="flex size-1.5 animate-pulse rounded-full bg-primary" />
              <Badge variant="secondary" className="font-mono text-[10px] tracking-wider">
                {lastUpdate || "--:--:--"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto py-2" style={{ minHeight: 0 }}>
            {carList.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted/20 ring-1 ring-border/10">
                  <CarIcon className="size-5 text-muted-foreground/20" />
                </div>
                <p className="text-xs text-muted-foreground/50">暂无车辆连接</p>
                <p className="text-[10px] text-muted-foreground/30">等待 ROS 节点上报位置</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {carList.map((car) => (
                  <VehicleRow key={car.car_id} car={car} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== 日志 ===== */}
      <div className="shrink-0">
        <Separator className="mb-5" />
        <div className="mb-3 flex items-center gap-2.5">
          <ClockIcon className="size-3.5 text-muted-foreground/50" />
          <h2 className="text-xs font-medium text-foreground/60">系统日志</h2>
          <span className="font-mono text-[10px] text-muted-foreground/30">最近 {logs.length} 条</span>
        </div>
        <div className="font-mono">
          {logs.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground/30">暂无日志</p>
          ) : (
            <div className="flex flex-col">
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-3 rounded px-2 py-1 text-xs transition-colors hover:bg-muted/30">
                  <CircleIcon
                    className={cn(
                      "mt-1 size-1.5 shrink-0",
                      log.type === "error" && "text-destructive",
                      log.type === "warn" && "text-primary",
                      log.type === "info" && "text-muted-foreground/40"
                    )}
                  />
                  <span className="shrink-0 text-[10px] text-muted-foreground/40 tabular-nums">{log.time}</span>
                  <span className="text-muted-foreground/60">{log.text}</span>
                </div>
              ))}
              {logFull && (
                <p className="mt-1 px-2 py-1 text-[10px] text-muted-foreground/25 italic">
                  仅显示最近 50 条，更多历史记录请查看 log 文件
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ==================== Stat Card ==================== */

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  description,
  tone = "muted",
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  unit: string
  description: string
  tone?: "muted" | "brand"
}) {
  return (
    <Card size="sm" className="group/card transition-shadow hover:shadow-sm">
      <CardContent className="flex items-center gap-3.5 py-3.5">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full ring-1 transition-colors group-hover/card:scale-110",
            tone === "brand"
              ? "bg-primary/10 text-primary ring-primary/15"
              : "bg-muted/50 text-muted-foreground ring-border/20 group-hover/card:bg-primary/10 group-hover/card:text-primary"
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <CardDescription className="tracking-widest uppercase">{label}</CardDescription>
          <div className="flex items-baseline gap-1">
            <span
              className={cn(
                "text-2xl font-bold tabular-nums tracking-tight",
                tone === "brand" && "text-primary"
              )}
            >
              {value}
            </span>
            {unit && (
              <span className="text-[11px] font-medium text-muted-foreground/40">{unit}</span>
            )}
          </div>
          <p className="truncate text-[10px] text-muted-foreground/35">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

/* ==================== Vehicle Row ==================== */

function VehicleRow({ car }: { car: CarPosition }) {
  const alive = car.speed > 0
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/10 bg-muted/10 p-2.5 transition-colors hover:border-border/25 hover:bg-muted/20">
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
            {car.car_id}
          </p>
          <p className="truncate font-mono text-[11px] text-muted-foreground/40 tabular-nums">
            {car.x.toFixed(1)}, {car.y.toFixed(1)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {alive && (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/40">
            {car.speed.toFixed(1)} m/s
          </span>
        )}
        <Badge variant={alive ? "default" : "secondary"} className="text-[10px]">
          {alive ? "运行" : "待机"}
        </Badge>
      </div>
    </div>
  )
}
