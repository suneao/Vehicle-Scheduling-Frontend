/**
 * 路线几何计算（投影 / 拆分），供地图组件与详情面板共用。
 */

/** 视为「已在路线上」的距离阈值（约 33 米） */
export const ON_ROUTE_THRESHOLD = 3e-4

/** 路径上距离某点最近的位置（返回投影点、所在段索引与距离） */
export function projectToPath(
  path: [number, number][],
  pos: [number, number]
): { index: number; point: [number, number]; distance: number } {
  if (path.length === 0) {
    return { index: 0, point: pos, distance: Infinity }
  }
  let bestIdx = 0
  let bestPoint: [number, number] = path[0]
  let bestD = Infinity
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy
    const t =
      len2 === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((pos[0] - a[0]) * dx + (pos[1] - a[1]) * dy) / len2)
          )
    const point: [number, number] = [a[0] + t * dx, a[1] + t * dy]
    const d = Math.hypot(pos[0] - point[0], pos[1] - point[1])
    if (d < bestD) {
      bestD = d
      bestIdx = i
      bestPoint = point
    }
  }
  return { index: bestIdx, point: bestPoint, distance: bestD }
}

/** 在最近投影点处把路径拆成「已行驶」和「未行驶」两段 */
export function splitPathAt(
  path: [number, number][],
  pos: [number, number]
): { before: [number, number][]; after: [number, number][] } {
  if (path.length < 2) return { before: path, after: [] }
  const { index, point } = projectToPath(path, pos)
  return {
    before: [...path.slice(0, index + 1), point],
    after: [point, ...path.slice(index + 1)],
  }
}
