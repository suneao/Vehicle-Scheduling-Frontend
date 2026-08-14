"use client"

import * as React from "react"
import Link from "next/link"
import { getVehicleCameras } from "@/lib/monitors"
import { MonitorFeed } from "@/components/monitor-feed"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { MonitorIcon, ExpandIcon, VideoOffIcon } from "lucide-react"

/**
 * 右侧信息栏的低分辨率监控预览；点击可进入完整监控页面。
 */
export function MonitorPreviewCard({
  kind,
  carId,
  online = true,
}: {
  kind: "vehicle" | "robot"
  carId: number
  online?: boolean
}) {
  const cameras = React.useMemo(() => getVehicleCameras(kind), [kind])
  const first = cameras[0]
  const href = `/schedule/monitor?kind=${kind}&car_id=${carId}`

  if (!online) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <MonitorIcon className="size-4 text-primary" />
            监控预览
          </CardTitle>
          <CardDescription>无监控</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-none border border-border/10 bg-muted/10">
            <VideoOffIcon className="size-5 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground/50">无监控</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <MonitorIcon className="size-4 text-primary" />
          监控预览
        </CardTitle>
        <CardDescription>低分辨率 · 共 {cameras.length} 路监控</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Link
          href={href}
          className="group relative block overflow-hidden rounded-none border border-border/10"
        >
          {first && (
            <MonitorFeed camera={first} lowRes className="aspect-video w-full" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="inline-flex items-center gap-1 text-xs text-white">
              <ExpandIcon className="size-3.5" />
              点击进入完整监控
            </span>
          </div>
        </Link>
        <Link
          href={href}
          className={buttonVariants({ size: "sm", className: "w-full" })}
        >
          <MonitorIcon data-icon="inline-start" />
          进入完整监控
        </Link>
      </CardContent>
    </Card>
  )
}
