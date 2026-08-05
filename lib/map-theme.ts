/**
 * 地图主题配置
 * 亮/暗模式分别配置高德地图主题，持久化到 localStorage
 */

export const MAP_STYLES = [
  { id: "normal", label: "标准", value: "amap://styles/normal" },
  { id: "dark", label: "幻影黑", value: "amap://styles/dark" },
  { id: "light", label: "月光银", value: "amap://styles/light" },
  { id: "whitesmoke", label: "远山黛", value: "amap://styles/whitesmoke" },
  { id: "fresh", label: "草色青", value: "amap://styles/fresh" },
  { id: "grey", label: "雅士灰", value: "amap://styles/grey" },
  { id: "graffiti", label: "涂鸦", value: "amap://styles/graffiti" },
  { id: "macaron", label: "马卡龙", value: "amap://styles/macaron" },
  { id: "blue", label: "靛青蓝", value: "amap://styles/blue" },
  { id: "darkblue", label: "极夜蓝", value: "amap://styles/darkblue" },
  { id: "wine", label: "酱籽", value: "amap://styles/wine" },
] as const

export interface MapThemeConfig {
  light: string
  dark: string
}

const STORAGE_KEY = "map_theme_config"

const DEFAULTS: MapThemeConfig = {
  light: "amap://styles/macaron",
  dark: "amap://styles/dark",
}

export function getMapThemeConfig(): MapThemeConfig {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<MapThemeConfig>
    return {
      light: parsed.light ?? DEFAULTS.light,
      dark: parsed.dark ?? DEFAULTS.dark,
    }
  } catch {
    return DEFAULTS
  }
}

export function setMapThemeConfig(config: MapThemeConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

/** 获取某个样式 id 的标签 */
export function mapStyleLabel(value: string): string {
  return MAP_STYLES.find((s) => s.value === value)?.label ?? value
}
