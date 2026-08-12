"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  getEvents,
  addEvent,
  updateEvent,
  deleteEvent,
  type ScheduleEvent,
} from "@/lib/events"
import { getRoutes } from "@/lib/routes"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  CheckIcon,
  XIcon,
  CalendarClockIcon,
  AlarmClockIcon,
  RouteIcon,
  CarIcon,
  PowerIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

/** 事件表单状态 */
interface EventForm {
  name: string
  time: string
  route_id: string
  vehicle_id: string
  action: "on" | "off"
  priority: number
}

const EMPTY_FORM: EventForm = {
  name: "",
  time: "08:00",
  route_id: "",
  vehicle_id: "1",
  action: "on",
  priority: 1,
}

export default function EventsPage() {
  const [events, setEvents] = React.useState<ScheduleEvent[]>([])
  const [routes, setRoutes] = React.useState(getRoutes())
  const [editing, setEditing] = React.useState<ScheduleEvent | null>(null)
  const [form, setForm] = React.useState<EventForm>(EMPTY_FORM)
  const [formOpen, setFormOpen] = React.useState(false)

  React.useEffect(() => {
    setEvents(getEvents())
    setRoutes(getRoutes())
  }, [])

  function refresh() {
    setEvents(getEvents())
  }

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(e: ScheduleEvent) {
    setEditing(e)
    setForm({
      name: e.name,
      time: e.time,
      route_id: String(e.route_id),
      vehicle_id: String(e.vehicle_id),
      action: e.action,
      priority: e.priority,
    })
    setFormOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error("请填写事件名称")
      return
    }
    if (!form.time) {
      toast.error("请选择时间")
      return
    }
    if (!form.route_id) {
      toast.error("请选择路线")
      return
    }
    if (!form.vehicle_id) {
      toast.error("请填写车辆编号")
      return
    }
    const payload = {
      name: form.name.trim(),
      time: form.time,
      route_id: Number(form.route_id),
      vehicle_id: Number(form.vehicle_id),
      action: form.action,
      priority: form.priority,
    }
    if (editing) {
      updateEvent(editing.id, payload)
      toast.success("事件已更新")
    } else {
      addEvent(payload)
      toast.success("事件已添加")
    }
    setFormOpen(false)
    refresh()
  }

  function handleDelete(id: number) {
    if (!confirm("确认删除该事件？")) return
    deleteEvent(id)
    toast.success("事件已删除")
    refresh()
  }

  function movePriority(id: number, dir: 1 | -1) {
    const list = [...getEvents()].sort((a, b) => b.priority - a.priority || a.id - b.id)
    const idx = list.findIndex((x) => x.id === id)
    if (idx === -1) return
    const target = idx + dir
    if (target < 0 || target >= list.length) return
    const cur = list[idx]
    const next = list[target]
    // 交换优先级
    const tmp = cur.priority
    updateEvent(cur.id, { priority: next.priority })
    updateEvent(next.id, { priority: tmp })
    refresh()
  }

  const routeName = (id: number) => getRoutes().find((r) => r.id === id)?.name ?? `路线 #${id}`

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
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
        <h1 className="text-sm font-medium">事件管理</h1>
        <span className="text-xs text-muted-foreground/40">优先级越高越先执行</span>
      </div>

      {/* 事件列表 */}
      <Card className="flex flex-col" style={{ minHeight: 0 }}>
        <CardHeader className="shrink-0 flex-row items-center justify-between border-b">
          <CardTitle className="flex items-center gap-2 text-xs">
            <CalendarClockIcon className="size-3.5 text-primary" />
            事件列表
          </CardTitle>
          <Button size="xs" onClick={openAdd}>
            <PlusIcon data-icon="inline-start" />
            添加事件
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0" style={{ minHeight: 0 }}>
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <CalendarClockIcon className="size-6 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground/50">暂无事件</p>
              <p className="text-[10px] text-muted-foreground/30">点击"添加事件"创建调度计划</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* 表头 */}
              <div className="flex items-center gap-3 border-b border-border/10 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                <span className="w-16 shrink-0">时间</span>
                <span className="flex-1">事件</span>
                <span className="w-24 shrink-0">路线</span>
                <span className="w-16 shrink-0">车辆</span>
                <span className="w-16 shrink-0">动作</span>
                <span className="w-10 shrink-0">优先级</span>
                <span className="w-14 shrink-0">操作</span>
              </div>
              {/* 行 */}
              {[...events]
                .sort((a, b) => b.priority - a.priority || a.id - b.id)
                .map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 border-b border-border/5 px-4 py-2 text-xs transition-colors hover:bg-muted/20"
                  >
                    <span className="w-16 shrink-0 font-mono text-muted-foreground/60 tabular-nums">
                      {ev.time}
                    </span>
                    <span className="flex-1 truncate font-medium">{ev.name}</span>
                    <span className="flex w-24 shrink-0 items-center gap-1 truncate text-muted-foreground/70">
                      <RouteIcon className="size-3 shrink-0 text-muted-foreground/30" />
                      {routeName(ev.route_id)}
                    </span>
                    <span className="flex w-16 shrink-0 items-center gap-1 text-muted-foreground/70">
                      <CarIcon className="size-3 shrink-0 text-muted-foreground/30" />
                      #{ev.vehicle_id}
                    </span>
                    <span className="w-16 shrink-0">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium",
                          ev.action === "on"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-destructive/10 text-destructive"
                        )}
                      >
                        {ev.action === "on" ? "开启" : "关闭"}
                      </span>
                    </span>
                    <div className="flex w-10 shrink-0 items-center gap-0.5">
                      <span className="font-mono text-muted-foreground/70">{ev.priority}</span>
                      <div className="flex flex-col">
                        <button
                          onClick={() => movePriority(ev.id, 1)}
                          className="text-muted-foreground/30 hover:text-foreground"
                        >
                          <ArrowUpIcon className="size-2.5" />
                        </button>
                        <button
                          onClick={() => movePriority(ev.id, -1)}
                          className="text-muted-foreground/30 hover:text-foreground"
                        >
                          <ArrowDownIcon className="size-2.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex w-14 shrink-0 items-center gap-1">
                      <button
                        onClick={() => openEdit(ev)}
                        className="flex size-6 items-center justify-center rounded text-muted-foreground/40 hover:bg-muted hover:text-foreground"
                      >
                        <PencilIcon className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(ev.id)}
                        className="flex size-6 items-center justify-center rounded text-muted-foreground/40 hover:bg-muted hover:text-destructive"
                      >
                        <Trash2Icon className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 事件表单 */}
      {formOpen && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xs">
              <AlarmClockIcon className="size-3.5 text-primary" />
              {editing ? "编辑事件" : "添加事件"}
            </CardTitle>
            <button
              onClick={() => setFormOpen(false)}
              className="flex size-5 items-center justify-center rounded text-muted-foreground/40 hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground/70">
                事件名称
                <Input
                  placeholder="如：车辆 1 早晨巡检"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground/70">
                执行时间
                <Input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground/70">
                关联路线
                <select
                  value={form.route_id}
                  onChange={(e) => setForm({ ...form, route_id: e.target.value })}
                  className="h-8 rounded-none border border-input bg-transparent px-2.5 text-xs"
                >
                  <option value="">选择路线…</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}（{r.points.length} 点）
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground/70">
                车辆编号
                <Input
                  type="number"
                  min={1}
                  value={form.vehicle_id}
                  onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground/70">
                车辆动作
                <div className="flex gap-2">
                  {(["on", "off"] as const).map((a) => (
                    <Button
                      key={a}
                      type="button"
                      variant={form.action === a ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setForm({ ...form, action: a })}
                    >
                      <PowerIcon data-icon="inline-start" />
                      {a === "on" ? "开启" : "关闭"}
                    </Button>
                  ))}
                </div>
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground/70">
                优先级（数字越大越优先）
                <Input
                  type="number"
                  min={1}
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 1 })}
                />
              </label>
              <div className="flex items-end gap-2 sm:col-span-2">
                <Button type="submit" className="flex-1">
                  <CheckIcon data-icon="inline-start" />
                  {editing ? "保存修改" : "添加事件"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
                  取消
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      )}
    </div>
  )
}
