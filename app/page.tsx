"use client"

import * as React from "react"
import {
  carsGetAllPositions,
  type CarPosition,
} from "@/lib/api"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  CarIcon,
  GaugeIcon,
  MapPinIcon,
  MapIcon,
  ActivityIcon,
  ClockIcon,
  CircleIcon,
} from "lucide-react"

export default function DashboardPage() {
  const [positions, setPositions] = React.useState<Record<string, CarPosition>>({})
  const [lastUpdate, setLastUpdate] = React.useState("")
  const [logs, setLogs] = React.useState<{ time: string; text: string; type: "info" | "warn" | "error" }[]>([])

  React.useEffect(() => {
    let cancelled = false

    function addLog(text: string, type: "info" | "warn" | "error" = "info") {
      setLogs((prev) => [
        { time: new Date().toLocaleTimeString("zh-CN"), text, type },
        ...prev.slice(0, 49),
      ])
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
    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const carList = Object.values(positions)

  const totalCars = carList.length
  const movingCars = carList.filter((c) => c.speed > 0).length
  const avgSpeed =
    totalCars > 0
      ? carList.reduce((sum, c) => sum + c.speed, 0) / totalCars
      : 0

  return (
    <div>
      {/* ===== 卡片区域 ===== */}
      <div className="grid gap-5" style={{ height: "calc(100vh - 3rem - 1rem - 2rem - 1.5rem)", gridTemplateRows: "auto 1fr" }}>
        {/* 顶部统计 */}
        <div className="grid shrink-0 grid-cols-3 gap-5">
          <StatCard icon={CarIcon} label="车辆总数" value={totalCars} unit="辆" sub={`在线 ${movingCars} 辆`} />
          <StatCard icon={ActivityIcon} label="活跃车辆" value={movingCars} unit="辆" sub="速度 > 0 m/s" highlight={movingCars > 0} />
          <StatCard icon={GaugeIcon} label="平均速度" value={avgSpeed.toFixed(2)} unit="m/s" sub="实时监测" />
        </div>

        {/* 主体：地图 + 侧栏 */}
        <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]" style={{ minHeight: 0 }}>
          {/* 地图 */}
          <Card className="relative flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-primary)_0%,transparent_70%)] opacity-[0.02]" />
            <CardHeader className="shrink-0">
              <CardTitle className="flex items-center gap-1.5 text-xs">
                <MapPinIcon className="size-3 text-primary" />
                地图监控
              </CardTitle>
            </CardHeader>
            <CardContent className="relative flex flex-1 items-center justify-center" style={{ minHeight: 0 }}>
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative flex size-20 items-center justify-center rounded-full bg-muted/50">
                  <MapIcon className="size-8 text-muted-foreground/20" />
                  <span className="absolute inset-0 animate-ping rounded-full border border-primary/10" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">地图接口接入中</p>
                  <p className="mt-1 text-xs text-muted-foreground/40">车辆位置将在地图上实时显示</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 右侧栏 */}
          <div className="flex flex-col gap-5" style={{ minHeight: 0 }}>
            {/* 车辆状态 */}
            <Card size="sm" className="flex flex-1 flex-col" style={{ minHeight: 0 }}>
              <CardHeader className="shrink-0 flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-1.5 text-xs">
                  <ActivityIcon className="size-3 text-primary" />
                  车辆状态
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <span className="flex size-1.5 rounded-full bg-primary animate-pulse" />
                  <Badge variant="secondary" className="text-[11px]">
                    {lastUpdate || "--:--:--"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
                {carList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted/50">
                      <CarIcon className="size-4 text-muted-foreground/30" />
                    </div>
                    <p className="text-xs text-muted-foreground">暂无车辆连接</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/40">等待 ROS 节点上报位置</p>
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
        </div>
      </div>

      {/* ===== 日志区域 ===== */}
      <div className="-mx-8 border-t border-border/30 px-8 py-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded-full bg-muted/50">
            <ClockIcon className="size-3 text-muted-foreground" />
          </div>
          <h2 className="text-xs font-medium">系统日志</h2>
          <span className="text-[11px] text-muted-foreground/60">最近 {logs.length} 条</span>
        </div>
        <div className="space-y-px font-mono">
          {logs.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground/40">暂无日志</p>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-none px-3 py-1.5 text-xs transition-colors hover:bg-muted/30"
              >
                <CircleIcon
                  className="mt-1 size-1.5 shrink-0"
                  style={{
                    color:
                      log.type === "error"
                        ? "var(--color-destructive)"
                        : log.type === "warn"
                          ? "#f59e0b"
                          : "var(--color-muted-foreground)",
                  }}
                />
                <span className="shrink-0 text-[11px] text-muted-foreground/60 tabular-nums">
                  {log.time}
                </span>
                <span className="text-muted-foreground">{log.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  unit: string
  sub: string
  highlight?: boolean
}) {
  return (
    <Card size="sm" className="group/card relative overflow-hidden transition-all hover:shadow-md">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 transition-opacity group-hover/card:opacity-100" />
      <CardContent className="flex items-center gap-3 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/60 ring-1 ring-border/30 transition-all group-hover/card:bg-primary/10 group-hover/card:ring-primary/20">
          <Icon className="size-4 text-muted-foreground transition-colors group-hover/card:text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground/70">{label}</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-bold tabular-nums tracking-tight ${highlight ? "text-primary" : ""}`}>
              {value}
            </span>
            <span className="text-[11px] text-muted-foreground/60">{unit}</span>
          </div>
          <p className="truncate text-[11px] text-muted-foreground/50">{sub}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function VehicleRow({ car }: { car: CarPosition }) {
  const alive = car.speed > 0
  return (
    <div className="group/row flex items-center justify-between rounded-none border border-border/20 p-2.5 transition-all hover:border-border/40 hover:bg-muted/30">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="size-2 shrink-0 rounded-full transition-shadow"
          style={{
            backgroundColor: alive ? "var(--color-primary)" : "var(--color-muted-foreground)",
            boxShadow: alive ? "0 0 8px var(--color-primary)" : "none",
          }}
        />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">车辆 {car.car_id}</p>
          <p className="truncate text-[11px] text-muted-foreground/60 tabular-nums">
            ({car.x.toFixed(1)}, {car.y.toFixed(1)})
          </p>
        </div>
      </div>
      <Badge variant={alive ? "default" : "secondary"} className="shrink-0 text-[11px] transition-all group-hover/row:scale-105">
        {alive ? `${car.speed.toFixed(2)} m/s` : "待机"}
      </Badge>
    </div>
  )
}
