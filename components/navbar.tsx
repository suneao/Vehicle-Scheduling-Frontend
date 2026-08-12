"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import {
  LogOutIcon,
  CarIcon,
  CalendarIcon,
  SettingsIcon,
  LayoutDashboardIcon,
  SunIcon,
  MoonIcon,
  UserIcon,
  CircleHelpIcon,
} from "lucide-react"

const navItems = [
  { href: "/", label: "仪表盘", icon: LayoutDashboardIcon },
  { href: "/schedule", label: "调度", icon: CalendarIcon },
  { href: "/settings", label: "设置", icon: SettingsIcon },
  { href: "/help", label: "帮助", icon: CircleHelpIcon },
]

const userItems = [{ href: "/account", label: "账户", icon: UserIcon }]

export function Navbar() {
  const pathname = usePathname()
  const { logout } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-screen-2xl items-center justify-between px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="group/logo flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 transition-colors group-hover/logo:bg-primary/15">
              <CarIcon className="size-3.5 text-primary" />
            </div>
            <span className="text-xs font-semibold tracking-widest uppercase text-foreground/80">
              车辆调度
            </span>
          </Link>

          <div className="flex items-center gap-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {userItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-foreground",
                  isActive && "bg-muted text-foreground"
                )}
              >
                <item.icon className="size-3.5" />
              </Link>
            )
          })}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="text-muted-foreground/60 hover:text-foreground"
            aria-label="切换主题"
          >
            <SunIcon className="size-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <MoonIcon className="absolute size-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          <Button variant="ghost" size="xs" onClick={logout} className="text-muted-foreground/60 hover:text-foreground">
            <LogOutIcon data-icon="inline-start" />
            退出
          </Button>
        </div>
      </div>
    </nav>
  )
}
