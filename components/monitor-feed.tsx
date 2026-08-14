"use client"

import * as React from "react"
import type { MonitorCamera } from "@/lib/monitors"
import { cn } from "@/lib/utils"

/** 不同视角的灭点偏移，让各监控画面略有区别 */
const DIRECTION_OFFSET: Record<MonitorCamera["direction"], number> = {
  front: 0,
  rear: Math.PI,
  left: -0.7,
  right: 0.7,
  top: 1.3,
  all: 0.35,
}

/**
 * 模拟监控画面：canvas 实时绘制（无真实视频流）。
 * - lowRes = 低分辨率预览（内部 320x180，画面更省性能）
 * - 全屏监控使用 1280x720
 * 画面由 CSS 缩放，配合外层 transform 实现放大/平移。
 */
export function MonitorFeed({
  camera,
  className,
  lowRes = false,
}: {
  camera: MonitorCamera
  className?: string
  lowRes?: boolean
}) {
  const ref = React.useRef<HTMLCanvasElement | null>(null)

  React.useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const w = lowRes ? 320 : 1280
    const h = lowRes ? 180 : 720
    canvas.width = w
    canvas.height = h

    const off = DIRECTION_OFFSET[camera.direction] ?? 0
    let raf = 0

    const draw = (now: number) => {
      drawScene(ctx, w, h, camera, off, now / 1000, lowRes)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(raf)
  }, [camera, lowRes])

  return <canvas ref={ref} className={cn("block h-full w-full", className)} />
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  camera: MonitorCamera,
  off: number,
  t: number,
  lowRes: boolean
) {
  ctx.clearRect(0, 0, w, h)

  const horizon = h * 0.62

  // 天空
  const sky = ctx.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, "#0a0f1e")
  sky.addColorStop(1, "#1b2a45")
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, horizon)

  // 地面
  const ground = ctx.createLinearGradient(0, horizon, 0, h)
  ground.addColorStop(0, "#2b3542")
  ground.addColorStop(1, "#141a22")
  ctx.fillStyle = ground
  ctx.fillRect(0, horizon, w, h - horizon)

  // 地平线
  ctx.strokeStyle = "rgba(255,255,255,0.08)"
  ctx.lineWidth = lowRes ? 1 : 2
  ctx.beginPath()
  ctx.moveTo(0, horizon)
  ctx.lineTo(w, horizon)
  ctx.stroke()

  // 灭点（随视角方向轻微摆动）
  const vx = w / 2 + Math.sin(t * 0.4 + off) * w * 0.12
  const vy = horizon

  // 透视车道线
  const lanes = 4
  for (let i = -lanes; i <= lanes; i++) {
    const bx = w / 2 + i * (w * 0.14)
    ctx.strokeStyle =
      i === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)"
    ctx.lineWidth = lowRes ? 1 : 2
    ctx.beginPath()
    ctx.moveTo(vx, vy)
    ctx.lineTo(bx, h)
    ctx.stroke()
  }

  // 模拟移动目标（其他车辆/行人）
  const count = lowRes ? 4 : 9
  for (let i = 0; i < count; i++) {
    const speed = 0.02 + (i % 3) * 0.015
    const x = ((i * 0.41 + t * speed) % 1) * w
    const depth = 0.68 + (i % 4) * 0.075
    const y = h * depth
    const size = lowRes ? 6 : 18
    ctx.fillStyle = `rgba(255,255,255,${0.12 + (i % 3) * 0.06})`
    ctx.fillRect(x - size / 2, y - size * 0.3, size, size * 0.6)
  }

  // 十字准星
  const cx = w / 2
  const cy = h / 2
  const g = lowRes ? 10 : 22
  ctx.strokeStyle = "rgba(255,255,255,0.28)"
  ctx.lineWidth = lowRes ? 1 : 2
  ctx.beginPath()
  ctx.moveTo(cx - g, cy)
  ctx.lineTo(cx - g * 0.35, cy)
  ctx.moveTo(cx + g * 0.35, cy)
  ctx.lineTo(cx + g, cy)
  ctx.moveTo(cx, cy - g)
  ctx.lineTo(cx, cy - g * 0.35)
  ctx.moveTo(cx, cy + g * 0.35)
  ctx.lineTo(cx, cy + g)
  ctx.stroke()

  // 扫描线（仅高分辨率）
  if (!lowRes) {
    ctx.fillStyle = "rgba(255,255,255,0.03)"
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
  }

  // 顶部信息
  const pad = lowRes ? 10 : 24
  ctx.fillStyle = "rgba(255,255,255,0.82)"
  ctx.font = `${lowRes ? 11 : 20}px ui-monospace, monospace`
  ctx.fillText(camera.label, pad, lowRes ? 18 : 36)

  const d = new Date()
  const ts = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
  ctx.fillStyle = "rgba(255,255,255,0.55)"
  ctx.fillText(ts, pad, lowRes ? 32 : 60)

  // REC 指示（闪烁）
  if (Math.floor(t * 2) % 2 === 0) {
    ctx.fillStyle = "#ef4444"
    ctx.beginPath()
    ctx.arc(w - pad - (lowRes ? 3 : 5), lowRes ? 14 : 26, lowRes ? 3 : 5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = "rgba(255,255,255,0.82)"
  ctx.font = `${lowRes ? 10 : 14}px ui-monospace, monospace`
  ctx.fillText("REC", w - pad - (lowRes ? 16 : 30), lowRes ? 18 : 32)
}
