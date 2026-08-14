/**
 * 地图标记 HTML 生成器（高德 AMap.Marker 的 content 用）
 * 供 route-map / schedule-map 等地图组件共用，保证样式一致。
 */

/** 圆形标记：彩色实心圆 + 白描边，可带文字（如编号、起） */
export function pointMarkerHtml(color: string, label = "", size = 18): string {
  const inner = label
    ? `<span style="font-size:${Math.max(9, Math.round(size * 0.56))}px;font-weight:600;color:#fff;line-height:1">${label}</span>`
    : ""
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;box-sizing:border-box">${inner}</div>`
}

/** 终点标记：白底圆 + 彩色圆环 + "终" 字 */
export function endMarkerHtml(color: string, size = 18): string {
  const fontSize = Math.max(9, Math.round(size * 0.56))
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#fff;border:3px solid ${color};display:flex;align-items:center;justify-content:center;box-sizing:border-box;color:${color};font-size:${fontSize}px;font-weight:600;line-height:1">终</div>`
}

/** 途径站点标记：菱形（旋转方框） + "停" 字 */
export function stopMarkerHtml(color: string, size = 18): string {
  const fontSize = Math.max(8, Math.round(size * 0.42))
  return `<div style="width:${Math.round(size * 0.72)}px;height:${Math.round(size * 0.72)}px;background:${color};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);transform:rotate(45deg);display:flex;align-items:center;justify-content:center;box-sizing:border-box"><span style="transform:rotate(-45deg);color:#fff;font-size:${fontSize}px;font-weight:600;line-height:1">停</span></div>`
}

/** 标记 SVG 外壳：按朝向旋转、按选中态放大 */
function markerSvg(opts: { angle?: number; selected?: boolean; inner: string }): string {
  const { angle, selected = false, inner } = opts
  const hasAngle = angle != null
  const size = selected ? 22 : 18
  const height = selected ? 27 : 22
  return `<svg width="${size}" height="${height}" viewBox="-2 -2 20 26" style="
    overflow:visible;
    transform:${hasAngle ? `rotate(${angle}deg)` : "none"};
    transform-box:fill-box;
    filter:drop-shadow(0 1px 2px rgba(0,0,0,0.25));
  ">${inner}</svg>`
}

/**
 * 车辆标记 SVG：俯视小车（车头朝上指示朝向），不含文字标签。
 * 供 map-view / schedule-map 复用，保证样式一致。
 */
export function vehicleMarkerSvg(opts: {
  color: string
  angle?: number
  alive: boolean
  selected?: boolean
}): string {
  const { color, angle, alive, selected = false } = opts
  const o = alive || selected ? 1 : 0.6
  const inner = `
    <rect x="3" y="1" width="12" height="18" rx="2.5" fill="${color}" stroke="#fff" stroke-width="1.4" opacity="${o}"/>
    <rect x="5" y="4" width="8" height="4" rx="1" fill="rgba(255,255,255,0.6)"/>
    <rect x="5" y="15" width="8" height="3" rx="1" fill="rgba(255,255,255,0.4)"/>
    <circle cx="4.6" cy="8" r="1.5" fill="#0b0b0b" stroke="#fff" stroke-width="0.6"/>
    <circle cx="13.4" cy="8" r="1.5" fill="#0b0b0b" stroke="#fff" stroke-width="0.6"/>
    <circle cx="4.6" cy="14" r="1.5" fill="#0b0b0b" stroke="#fff" stroke-width="0.6"/>
    <circle cx="13.4" cy="14" r="1.5" fill="#0b0b0b" stroke="#fff" stroke-width="0.6"/>
  `
  return markerSvg({ angle, selected, inner })
}

/**
 * 机器狗标记 SVG：沿用旧版车辆水滴形状（尖端朝上指示朝向）。
 */
export function robotMarkerSvg(opts: {
  color: string
  angle?: number
  alive: boolean
  selected?: boolean
}): string {
  const { color, angle, alive, selected = false } = opts
  const o = alive || selected ? 1 : 0.6
  const inner = `
    <path d="M8 1 C 12 6.5 15 10 15 13 A 7 7 0 1 1 1 13 C 1 10 4 6.5 8 1 Z"
      fill="${color}" stroke="#fff" stroke-width="1.5" opacity="${o}" />
    <circle cx="8" cy="13" r="3.5" fill="none" stroke="#fff" stroke-width="1.5" />
  `
  return markerSvg({ angle, selected, inner })
}
