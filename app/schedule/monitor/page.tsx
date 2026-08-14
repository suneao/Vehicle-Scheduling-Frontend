"use client"

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { carsGetAllPositions, type CarPosition } from "@/lib/api"
import { getVehicleCameras } from "@/lib/monitors"
import { MonitorFeed } from "@/components/monitor-feed"
import { InfoRow } from "@/components/info-row"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeftIcon,
  CarIcon,
  BotIcon,
  ZoomInIcon,
  ZoomOutIcon,
  MaximizeIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <p className="text-xs text-muted-foreground/40">监控加载中…</p>
    </div>
  )
}

function MonitorContent() {
  const params = useSearchParams()
  const kind = params.get("kind") === "robot" ? "robot" : "vehicle"
  const carId = Number(params.get("car_id") ?? "1")

  const cameras = React.useMemo(() => getVehicleCameras(kind), [kind])
  const [activeId, setActiveId] = React.useState(cameras[0]?.id ?? "front")
  const activeCamera = cameras.find((c) => c.id === activeId) ?? cameras[0]

  const [vehicle, setVehicle] = React.useState<CarPosition | null>(null)
  const [zoom, setZoom] = React.useState(1)
  const [pan, setPan] = React.useState({ x: 0, y: 0 })

  const dragRef = React.useRef<{
    sx: number
    sy: number
    px: number
    py: number
  } | null>(null)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)

  // 轮询选中车辆/机器狗位置
  React.useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await carsGetAllPositions()
        if (cancelled) return
        const data = (res.data as Record<string, CarPosition>) ?? {}
        const found = Object.values(data).find((v) => v.car_id === carId) ?? null
        setVehicle(found)
      } catch {
        /* ignore */
      }
    }
    poll()
    const t = setInterval(poll, 1000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [carId])

  // 鼠标滚轮缩放（需 passive:false 才能阻止页面滚动）
  React.useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom((z) => clamp(z + (e.deltaY < 0 ? 0.2 : -0.2), 1, 4))
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  function resetView() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  function panBy(dx: number, dy: number) {
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    setPan({
      x: dragRef.current.px + (e.clientX - dragRef.current.sx),
      y: dragRef.current.py + (e.clientY - dragRef.current.sy),
    })
  }

  function onPointerUp() {
    dragRef.current = null
  }

  const alive = vehicle ? vehicle.speed > 0 : false
  const backHref = kind === "robot" ? "/schedule/patrol" : "/schedule/vehicle"
  const unitLabel = kind === "robot" ? "机器狗" : "车辆"

  return (
    <div className="flex flex-1 flex-col gap-5">
      {/* 顶部导航 */}
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 rounded-none px-2 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3" />
          {kind === "robot" ? "机器狗调度" : "车辆调度"}
        </Link>
        <Separator orientation="vertical" className="h-4" />
        <h1 className="flex items-center gap-2 text-sm font-medium">
          {kind === "robot" ? (
            <BotIcon className="size-4 text-primary" />
          ) : (
            <CarIcon className="size-4 text-primary" />
          )}
          {unitLabel} #{carId} · 实时监控
        </h1>
        {vehicle && (
          <Badge variant={alive ? "default" : "secondary"} className="text-[10px]">
            {alive ? "运行中" : "待机"}
          </Badge>
        )}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground/40 tabular-nums">
          当前画面：{activeCamera?.label}
        </span>
      </div>

      {/* 主区域 */}
      <div
        className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[3fr_1fr]"
        style={{ minHeight: 0 }}
      >
        {/* 视频画面 */}
        <Card className="flex flex-col" style={{ minHeight: 0 }}>
          <CardContent
            className="relative flex-1 p-0!"
            style={{ minHeight: 0 }}
          >
            <div
              ref={viewportRef}
              className="absolute inset-0 cursor-grab touch-none overflow-hidden bg-black select-none active:cursor-grabbing"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {vehicle ? (
                <>
                  <div
                    className="absolute inset-0"
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transformOrigin: "center center",
                    }}
                  >
                    {activeCamera && (
                      <MonitorFeed camera={activeCamera} className="h-full w-full" />
                    )}
                  </div>

                  {/* 缩放按钮 */}
                  <div className="absolute right-3 top-3 flex flex-col gap-1">
                    <IconButton
                      label="放大"
                      onClick={() => setZoom((z) => clamp(z + 0.2, 1, 4))}
                    >
                      <ZoomInIcon />
                    </IconButton>
                    <IconButton
                      label="缩小"
                      onClick={() => setZoom((z) => clamp(z - 0.2, 1, 4))}
                    >
                      <ZoomOutIcon />
                    </IconButton>
                    <IconButton label="重置视角" onClick={resetView}>
                      <MaximizeIcon />
                    </IconButton>
                  </div>

                  {/* 平移按钮 */}
                  <div className="absolute bottom-3 right-3 grid grid-cols-3 gap-1">
                    <span />
                    <IconButton label="上移" onClick={() => panBy(0, -24)}>
                      <ChevronUpIcon />
                    </IconButton>
                    <span />
                    <IconButton label="左移" onClick={() => panBy(-24, 0)}>
                      <ChevronLeftIcon />
                    </IconButton>
                    <IconButton label="居中" onClick={resetView}>
                      <MaximizeIcon />
                    </IconButton>
                    <IconButton label="右移" onClick={() => panBy(24, 0)}>
                      <ChevronRightIcon />
                    </IconButton>
                    <span />
                    <IconButton label="下移" onClick={() => panBy(0, 24)}>
                      <ChevronDownIcon />
                    </IconButton>
                    <span />
                  </div>

                  {/* 缩放比例 */}
                  <div className="absolute bottom-3 left-3 rounded-none bg-black/55 px-2 py-1 font-mono text-[10px] text-white tabular-nums">
                    {Math.round(zoom * 100)}%
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <VideoOffIcon className="size-6 text-white/30" />
                  <p className="text-xs text-white/50">无监控</p>
                  <p className="text-[10px] text-white/30">车辆暂未上报数据</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 右侧面板 */}
        <div className="flex flex-col gap-5" style={{ minHeight: 0 }}>
          {/* 监控切换 */}
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <VideoIcon className="size-4 text-primary" />
                监控切换
              </CardTitle>
              <CardDescription>共 {cameras.length} 路监控</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {cameras.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-xs transition-all active:scale-[0.99]",
                    c.id === activeId
                      ? "border-foreground bg-muted/30"
                      : "border-border/10 bg-muted/10 hover:border-border/25 hover:bg-muted/20"
                  )}
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      c.id === activeId ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  />
                  <span className="flex-1 font-medium">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground/40">
                    {c.label}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* 实时数据 */}
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">实时数据</CardTitle>
              <CardDescription>{unitLabel} #{carId}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {vehicle ? (
                <>
                  <InfoRow label="坐标">
                    ({vehicle.x.toFixed(5)}, {vehicle.y.toFixed(5)})
                  </InfoRow>
                  <InfoRow label="速度">{vehicle.speed.toFixed(2)} m/s</InfoRow>
                  {vehicle.battery != null && (
                    <InfoRow label="电量">
                      <span className={vehicle.battery <= 20 ? "text-destructive" : undefined}>
                        {vehicle.battery}%
                      </span>
                    </InfoRow>
                  )}
                  {vehicle.angle != null && (
                    <InfoRow label="朝向">{vehicle.angle.toFixed(1)}°</InfoRow>
                  )}
                  {vehicle.update_time && (
                    <InfoRow label="更新">{vehicle.update_time}</InfoRow>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground/50">
                  等待{unitLabel}上报位置…
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function MonitorPage() {
  return (
    <Suspense fallback={<Loading />}>
      <MonitorContent />
    </Suspense>
  )
}

function IconButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="flex size-8 items-center justify-center rounded-none border border-white/20 bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75 [&_svg]:size-4"
    >
      {children}
    </button>
  )
}


