"use client"

import * as React from "react"
import createGlobe from "cobe"
import { useTheme } from "next-themes"

interface Marker {
  location: [number, number]
  size: number
  id: string
}

interface GlobeProps {
  markers?: Marker[]
  className?: string
}

export function Globe({ markers = [], className }: GlobeProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const globeRef = React.useRef<ReturnType<typeof createGlobe> | null>(null)
  const markersRef = React.useRef(markers)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  // 只在挂载时创建 globe
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let phi = 0

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: canvas.clientWidth * 2,
      height: canvas.clientHeight * 2,
      phi: 0,
      theta: 0.3,
      dark: isDark ? 1 : 0,
      diffuse: isDark ? 1.2 : 0.8,
      mapSamples: isDark ? 8000 : 6000,
      mapBrightness: isDark ? 20 : 8,
      mapBaseBrightness: isDark ? 0 : 0.02,
      baseColor: isDark ? [0.03, 0.03, 0.03] : [1, 1, 1],
      markerColor: isDark ? [1, 1, 1] : [0.05, 0.05, 0.05],
      glowColor: isDark ? [0.06, 0.06, 0.06] : [0.88, 0.88, 0.88],
      markers: markersRef.current.map((m) => ({
        location: m.location,
        size: m.size,
        id: m.id,
      })),
      scale: 0.85,
    })

    globeRef.current = globe

    function animate() {
      phi += 0.003
      globe.update({ phi })
      requestAnimationFrame(animate)
    }
    animate()

    const observer = new ResizeObserver(() => {
      if (canvas) {
        globe.update({
          width: canvas.clientWidth * 2,
          height: canvas.clientHeight * 2,
        })
      }
    })
    observer.observe(canvas)

    return () => {
      globe.destroy()
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 主题切换时重建 globe
  React.useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    globe.update({
      dark: isDark ? 1 : 0,
      diffuse: isDark ? 1.2 : 0.8,
      mapBrightness: isDark ? 20 : 8,
      mapBaseBrightness: isDark ? 0 : 0.02,
      baseColor: isDark ? [0.03, 0.03, 0.03] : [1, 1, 1],
      markerColor: isDark ? [1, 1, 1] : [0.05, 0.05, 0.05],
      glowColor: isDark ? [0.06, 0.06, 0.06] : [0.88, 0.88, 0.88],
    })
  }, [isDark])

  // markers 变化时增量更新
  React.useEffect(() => {
    markersRef.current = markers
    globeRef.current?.update({
      markers: markers.map((m) => ({
        location: m.location,
        size: m.size,
        id: m.id,
      })),
    })
  }, [markers])

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="size-full"
        style={{ contain: "layout paint size" }}
      />
    </div>
  )
}
