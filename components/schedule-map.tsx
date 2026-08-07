"use client"

import * as React from "react"
import AMapLoader from "@amap/amap-jsapi-loader"
import { useTheme } from "next-themes"
import type { CarPosition } from "@/lib/api"
import { getMapThemeConfig } from "@/lib/map-theme"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LocateFixedIcon, MoveIcon, CrosshairIcon } from "lucide-react"

/* ==================== 高德类型声明 ==================== */

/** 地图实例最小类型 */
interface AMapMapInstance {
  destroy: () => void
  resize: () => void
  setFitView: (overlays: unknown[] | null, immediately: boolean, padding: number[]) => void
  setMapStyle: (style: string) => void
  addControl: (control: unknown) => void
  on: (event: string, handler: () => void) => void
  getZoom: () => number
  setZoom: (zoom: number) => void
  setCenter: (center: [number, number]) => void
  setRotation: (deg: number, immediate?: boolean) => void
  setPitch: (pitch: number) => void
}

/** 标记实例最小类型 */
interface AMapMarkerInstance {
  setMap: (map: AMapMapInstance | null) => void
}

/** AMap 命名空间最小类型 */
interface AMapNamespace {
  Map: new (container: HTMLElement, opts: Record<string, unknown>) => AMapMapInstance
  Marker: new (opts: Record<string, unknown>) => AMapMarkerInstance
  Pixel: new (x: number, y: number) => unknown
  Scale: new () => unknown
  ToolBar: new (opts: Record<string, unknown>) => unknown
}

const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY ?? ""
const AMAP_SECURITY_CODE = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE ?? ""

const DEFAULT_CENTER: [number, number] = [114.003, 22.602]
const DEFAULT_ZOOM = 16

/**
 * 强制瓦片高清化：把瓦片 URL 的 scale=1 改为 scale=2（512px 高清瓦片）。
 * 高德仅在 DPR>=2 时请求高清瓦片，非标准缩放（如 1.25/1.333）会用到模糊的 256px 瓦片。
 */
function upgradeTileResolution(container: HTMLElement | null) {
  if (!container) return

  container.querySelectorAll<HTMLImageElement>(".amap-layer-tile img").forEach(upgradeImg)

  const observer = new MutationObserver(() => {
    container.querySelectorAll<HTMLImageElement>(".amap-layer-tile img").forEach(upgradeImg)
  })
  observer.observe(container, { childList: true, subtree: true })
  ;(container as HTMLElement & { _tileObserver?: MutationObserver })._tileObserver = observer
}

/** 将单个瓦片 img 的 scale 参数提升为 2 */
function upgradeImg(img: HTMLImageElement) {
  if (img.dataset.hd === "1") return
  img.dataset.hd = "1"
  const newSrc = img.src.replace(/scale=\d+/, "scale=2")
  if (newSrc !== img.src) {
    img.src = newSrc
  }
}

interface ScheduleMapProps {
  vehicles: CarPosition[]
  onSelect: (vehicle: CarPosition | null) => void
  selectedId?: number
}

export function ScheduleMap({ vehicles, onSelect, selectedId }: ScheduleMapProps) {
  const { resolvedTheme } = useTheme()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<{ instance: AMapMapInstance; AMap: AMapNamespace } | null>(null)
  const markersRef = React.useRef<AMapMarkerInstance[]>([])
  const onSelectRef = React.useRef(onSelect)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  // 视角模式：follow = 跟随选中车辆/自动囊括所有车辆；free = 自由拖动
  const [mode, setMode] = React.useState<"follow" | "free">("follow")
  // WebGL 是否被高德实际使用：false 时地图降级为 img 瓦片渲染，主题无法切换，强制亮色
  const [webglUsed, setWebglUsed] = React.useState<boolean | null>(null)

  const mapStyle = React.useMemo(() => {
    const cfg = getMapThemeConfig()
    // WebGL 不可用时地图固定亮色主题，忽略暗色配置
    if (webglUsed === false) return cfg.light
    return resolvedTheme === "dark" ? cfg.dark : cfg.light
  }, [resolvedTheme, webglUsed])

  // 主初始化 effect 需要初始 mapStyle，但不随主题重建地图：用 ref 传递
  const mapStyleRef = React.useRef(mapStyle)
  React.useEffect(() => {
    mapStyleRef.current = mapStyle
  }, [mapStyle])

  // 保持最新回调（不能直接在 render 中改 ref）
  React.useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  // 初始化地图
  React.useEffect(() => {
    let cancelled = false
    const container = containerRef.current
    window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE }

    AMapLoader.load({ key: AMAP_KEY, version: "2.0", plugins: ["AMap.Scale"] })
      .then((AMap: AMapNamespace) => {
        if (cancelled || !container) return

        const map = new AMap.Map(container, {
          // viewMode 3D 支持地图旋转，pitch 0 保持平面俯视（视觉等同 2D）
          viewMode: "3D",
          pitch: 0,
          rotation: 0,
          zoom: DEFAULT_ZOOM,
          center: DEFAULT_CENTER,
          mapStyle: mapStyleRef.current,
          resizeEnable: true,
          devicePixelRatio: 2,
        })
        map.addControl(new AMap.Scale())
        map.on("complete", () => {
          map.resize()
          upgradeTileResolution(container)
          // 检测高德是否实际使用 WebGL 渲染（WebGL 渲染会创建 canvas，img 瓦片降级则无 canvas）
          setWebglUsed(container.querySelectorAll("canvas").length > 0)
        })
        mapRef.current = { instance: map, AMap }
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      ;(container as HTMLElement & { _tileObserver?: MutationObserver } | null)?._tileObserver?.disconnect()
      mapRef.current?.instance?.destroy()
      mapRef.current = null
    }
  }, [])

  // 主题切换
  React.useEffect(() => {
    mapRef.current?.instance?.setMapStyle(mapStyle)
  }, [mapStyle])

  // 视角控制：跟随模式自动调整地图视角
  React.useEffect(() => {
    const map = mapRef.current?.instance
    if (!map) return
    if (mode === "free") return

    // 选中车辆：地图中心跟随车辆，放大局部视角
    if (selectedId != null) {
      const v = vehicles.find((item) => item.car_id === selectedId)
      if (v) {
        map.setCenter([v.x, v.y])
        map.setPitch(0)
        // 放大到局部视角（不低于 18 级）
        if (map.getZoom() < 18) map.setZoom(18)
      }
      return
    }

    // 未选中：动态囊括所有车辆的最佳视角
    map.setRotation(0)
    map.setPitch(0)
    if (vehicles.length > 0) {
      map.setFitView(null, false, [60, 60, 60, 60])
    }
  }, [vehicles, selectedId, mode])

  // 居中按钮：重置视角为初始位置
  function centerMap() {
    const map = mapRef.current?.instance
    if (!map) return
    map.setCenter(DEFAULT_CENTER)
    map.setZoom(DEFAULT_ZOOM)
    map.setRotation(0)
    map.setPitch(0)
  }

  // 地图是否处于强制亮色模式（WebGL 不可用时）：按钮需用亮色配置
  const lightMap = webglUsed === false

  // 模式按钮样式：选中时固定背景不 hover 反转（避免边框与 hover 背景同色），选中边框用主题主色
  function modeBtnClass(active: boolean, light: boolean): string {
    if (light) {
      // 亮色地图模式：强制白底黑字（! 覆盖 outline 变体的 dark 半透明背景/边框）
      return active
        ? "gap-1 border-2 border-black! bg-white! text-black"
        : "gap-1 border border-neutral-300 bg-white! text-black hover:bg-black! hover:text-white!"
    }
    return active
      ? "gap-1 border-2 border-primary! bg-background text-foreground"
      : "gap-1 border border-border bg-background text-foreground hover:bg-foreground hover:text-background"
  }

  // 居中按钮样式（无选中态）
  function centerBtnClass(light: boolean): string {
    return light
      ? "size-7 border border-neutral-300 bg-white! p-0! text-black hover:bg-black! hover:text-white!"
      : "size-7 border border-border bg-background p-0! text-foreground hover:bg-foreground hover:text-background"
  }

  // 更新车辆标记
  React.useEffect(() => {
    const entry = mapRef.current
    if (!entry) return
    const { instance: map, AMap } = entry

    for (const m of markersRef.current) m.setMap(null)
    markersRef.current = []

    if (vehicles.length === 0) return

    const markers: AMapMarkerInstance[] = []

    for (const v of vehicles) {
      const alive = v.speed > 0
      const hasAngle = v.angle != null
      const isSelected = v.car_id === selectedId
      // WebGL 不可用时地图降级为亮色渲染，marker 固定用亮色主题主色（近黑，非黄色）以保证可见
      const base = isSelected
        ? "#22c55e"
        : webglUsed === false
          ? "#212121"
          : "var(--color-primary,#f59e0b)"

      const el = document.createElement("div")
      el.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;"
      const dotSize = isSelected ? 20 : 16
      el.innerHTML = `
        <svg width="${isSelected ? 20 : 16}" height="${isSelected ? 25 : 20}" viewBox="-2 -2 20 25" style="
          overflow:visible;
          /* 水滴尖端指示车辆朝向（地图不旋转，marker 直接指示方向） */
          transform:${hasAngle ? `rotate(${v.angle}deg)` : "none"};
          transform-box:fill-box;
          filter:drop-shadow(0 1px 2px rgba(0,0,0,0.25));
        ">
          <path d="M8 1 C 12 6.5 15 10 15 13 A 7 7 0 1 1 1 13 C 1 10 4 6.5 8 1 Z"
            fill="${base}" stroke="#fff" stroke-width="1.5"
            opacity="${alive || isSelected ? 1 : 0.6}" />
          <circle cx="8" cy="13" r="3.5" fill="none" stroke="#fff" stroke-width="1.5" />
        </svg>
        <span style="
          margin-top:4px;font-size:10px;font-weight:600;
          font-family:monospace;color:#333;
          background:rgba(255,255,255,0.9);
          padding:1px 5px;border-radius:2px;
          white-space:nowrap;
        ">#${v.car_id}</span>
        <span style="
          font-size:9px;color:#666;
          margin-top:1px;
        ">${v.speed.toFixed(1)} m/s${hasAngle ? " · " + v.angle?.toFixed(0) + "°" : ""}</span>
      `

      const marker = new AMap.Marker({
        position: [v.x, v.y] as [number, number],
        content: el,
        offset: new AMap.Pixel(0, -25),
        zIndex: isSelected ? 300 : alive ? 200 : 100,
      })

      el.addEventListener("click", (e) => {
        e.stopPropagation()
        // 再次单击已选中的车辆 → 取消选中
        if (v.car_id === selectedId) {
          onSelectRef.current(null)
        } else {
          onSelectRef.current(v)
        }
      })

      marker.setMap(map)
      markers.push(marker)
    }

    markersRef.current = markers
  }, [vehicles, selectedId])

  // 容器尺寸变化时重算地图渲染（flex 布局调整后保持高清）
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      mapRef.current?.instance?.resize()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    // 绝对定位填满父级（父级需 relative），避免 flex 中 height:100% 解析为 0 导致渲染模糊
    <div className="absolute inset-0">
      <div ref={containerRef} className="size-full" />

      {/* 视角控制按钮（右上角，独立按钮） */}
      {!loading && !error && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode("follow")}
            className={modeBtnClass(mode === "follow", lightMap)}
          >
            <LocateFixedIcon className="size-3.5" />
            跟随
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode("free")}
            className={modeBtnClass(mode === "free", lightMap)}
          >
            <MoveIcon className="size-3.5" />
            自由
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={centerMap}
            aria-label="居中"
            className={centerBtnClass(lightMap)}
          >
            <CrosshairIcon className="size-3.5" />
          </Button>
        </div>
      )}

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/50">
          <p className="text-xs text-muted-foreground/40">地图加载中…</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-muted-foreground/40">地图加载失败: {error}</p>
        </div>
      )}
    </div>
  )
}
