import * as React from "react"

/**
 * 详情面板/监控页通用的「标签 + 值」信息行。
 * 可选传入图标；icon 省略时只显示标签与值（监控页使用）。
 */
export function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 text-xs">
      {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground/40" />}
      <span className="w-10 shrink-0 text-muted-foreground/50">{label}</span>
      <span className="font-mono tabular-nums text-foreground/80">{children}</span>
    </div>
  )
}
