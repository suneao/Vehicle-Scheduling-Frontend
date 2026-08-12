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
