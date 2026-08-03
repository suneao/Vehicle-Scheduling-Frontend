"use client"

import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CarIcon, BotIcon, ArrowRightIcon } from "lucide-react"

const modules = [
  {
    href: "/schedule/vehicle",
    icon: CarIcon,
    title: "车辆调度",
    description: "管理 AGV 小车任务分配、路径规划与状态监控",
  },
  {
    href: "/schedule/patrol",
    icon: BotIcon,
    title: "机器狗巡逻调度",
    description: "管理机器狗巡检任务、巡逻路线与实时定位",
  },
]

export default function SchedulePage() {
  return (
    <div className="grid flex-1 grid-cols-1 gap-5 md:grid-cols-2">
      {modules.map((m) => (
        <Link key={m.href} href={m.href}>
          <Card className="group/card h-full cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="flex h-full flex-col gap-4 p-6">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/15 transition-colors group-hover/card:bg-primary/20">
                <m.icon className="size-6 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="mb-1.5 flex items-center gap-2 text-base">
                  {m.title}
                  <ArrowRightIcon className="size-4 text-muted-foreground/30 transition-all group-hover/card:translate-x-1 group-hover/card:text-primary" />
                </CardTitle>
                <CardDescription>{m.description}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  )
}
