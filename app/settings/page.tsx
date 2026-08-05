"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select"
import {
  getMapThemeConfig,
  setMapThemeConfig,
  MAP_STYLES,
  mapStyleLabel,
  type MapThemeConfig,
} from "@/lib/map-theme"
import {
  SunIcon,
  MoonIcon,
  MonitorIcon,
  MapIcon,
  PaletteIcon,
} from "lucide-react"

const THEME_OPTIONS = [
  { value: "light", label: "亮色", icon: SunIcon },
  { value: "dark", label: "暗色", icon: MoonIcon },
  { value: "system", label: "跟随系统", icon: MonitorIcon },
] as const

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [mapConfig, setMapConfig] = React.useState<MapThemeConfig>({
    light: "amap://styles/macaron",
    dark: "amap://styles/dark",
  })
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    setMapConfig(getMapThemeConfig())
    setLoaded(true)
  }, [])

  function updateMapConfig(key: keyof MapThemeConfig, value: string) {
    const next = { ...mapConfig, [key]: value }
    setMapConfig(next)
    setMapThemeConfig(next)
    toast.success("地图主题已保存")
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {/* ===== 外观 ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-sm">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/15">
              <PaletteIcon className="size-4 text-primary" />
            </span>
            外观
          </CardTitle>
          <CardDescription>选择界面主题模式</CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            value={theme ? [theme] : ["system"]}
            onValueChange={(values) => {
              if (values.length > 0) setTheme(values[0])
            }}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {THEME_OPTIONS.map((opt) => (
              <ToggleGroupItem
                key={opt.value}
                value={opt.value}
                className="flex-1 justify-center gap-1.5"
              >
                <opt.icon className="size-3.5" />
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="mt-3 text-xs text-muted-foreground/40">
            快捷键 <kbd className="rounded border border-border px-1 font-mono text-[10px]">D</kbd>{" "}
            可在亮色与暗色之间快速切换
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* ===== 地图主题 ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-sm">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/15">
              <MapIcon className="size-4 text-primary" />
            </span>
            地图主题
          </CardTitle>
          <CardDescription>亮色与暗色模式可分别配置地图样式</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* 亮色地图主题 */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <SunIcon className="size-4 text-muted-foreground/40" />
              <div>
                <p className="text-xs font-medium">亮色模式地图</p>
                <p className="text-[10px] text-muted-foreground/40">
                  当前: {loaded ? mapStyleLabel(mapConfig.light) : "…"}
                </p>
              </div>
            </div>
            <Select
              value={mapConfig.light}
              onValueChange={(v) => {
                if (v) updateMapConfig("light", v)
              }}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>亮色地图样式</SelectLabel>
                  {MAP_STYLES.filter((s) => !["dark", "darkblue"].includes(s.id)).map((s) => (
                    <SelectItem key={s.id} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* 暗色地图主题 */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <MoonIcon className="size-4 text-muted-foreground/40" />
              <div>
                <p className="text-xs font-medium">暗色模式地图</p>
                <p className="text-[10px] text-muted-foreground/40">
                  当前: {loaded ? mapStyleLabel(mapConfig.dark) : "…"}
                </p>
              </div>
            </div>
            <Select
              value={mapConfig.dark}
              onValueChange={(v) => {
                if (v) updateMapConfig("dark", v)
              }}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>暗色地图样式</SelectLabel>
                  {MAP_STYLES.filter((s) => ["dark", "darkblue", "grey", "wine", "normal"].includes(s.id)).map((s) => (
                    <SelectItem key={s.id} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <p className="text-[10px] text-muted-foreground/30">
            保存后立即生效，主页与调度页地图同步更新
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
