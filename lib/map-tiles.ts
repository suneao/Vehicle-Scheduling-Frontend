/**
 * 高德瓦片高清化工具。
 * 高德仅在 DPR>=2 时请求高清瓦片；非标准缩放（如 1.25/1.333）会回退到模糊的 256px 瓦片，
 * 这里强制把瓦片 URL 的 scale=1 改为 scale=2（512px 高清瓦片）。
 */

/** 单个瓦片 img 的 scale 参数提升为 2（幂等） */
export function upgradeImg(img: HTMLImageElement): void {
  if (img.dataset.hd === "1") return
  img.dataset.hd = "1"
  const newSrc = img.src.replace(/scale=\d+/, "scale=2")
  if (newSrc !== img.src) img.src = newSrc
}

/**
 * 对地图容器启用瓦片高清化：立即处理已存在的瓦片，并监听新瓦片插入。
 * 返回用于清理的 MutationObserver。
 */
export function upgradeTileResolution(container: HTMLElement | null): MutationObserver | null {
  if (!container) return null

  const upgradeAll = () => {
    container.querySelectorAll<HTMLImageElement>(".amap-layer-tile img").forEach(upgradeImg)
  }
  upgradeAll()

  const observer = new MutationObserver(upgradeAll)
  observer.observe(container, { childList: true, subtree: true })
  return observer
}
