"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  LogOutIcon,
  CarIcon,
  CalendarIcon,
  SettingsIcon,
  LayoutDashboardIcon,
} from "lucide-react"

const navItems = [
  { href: "/", label: "主页", icon: CarIcon },
  { href: "/schedule", label: "调度", icon: CalendarIcon },
  { href: "/settings", label: "设置", icon: SettingsIcon },
]

export function Navbar() {
  const pathname = usePathname()
  const { logout } = useAuth()

  return (
    <nav className="sticky top-0 z-50 border-b border-border/20 bg-background/50 backdrop-blur-2xl backdrop-saturate-200">
      <div className="mx-auto flex h-12 max-w-screen-2xl items-center justify-between px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/10">
              <LayoutDashboardIcon className="size-3.5 text-primary" />
            </div>
            <span className="text-xs font-semibold tracking-wider">
              车辆调度
            </span>
          </Link>

          <div className="flex items-center">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative inline-flex items-center gap-1.5 rounded-none px-3.5 py-1.5 text-xs font-medium transition-all",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground/60 hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute inset-x-2.5 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent" />
                  )}
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>

        <Button variant="ghost" size="xs" onClick={logout} className="text-muted-foreground/60 hover:text-foreground">
          <LogOutIcon data-icon="inline-start" />
          退出
        </Button>
      </div>
    </nav>
  )
}
