"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { useAuth } from "@/components/auth-provider"

const AUTH_PAGES = ["/login", "/register"]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  // 全局鉴权守卫：未登录访问任何受保护页面时跳转登录页
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated && !AUTH_PAGES.includes(pathname)) {
      console.warn("[shell] guard: redirect to /login from", pathname)
      router.replace("/login")
    }
  }, [isLoading, isAuthenticated, router, pathname])

  if (AUTH_PAGES.includes(pathname)) {
    return <>{children}</>
  }

  // 等待鉴权状态确定
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-xs text-muted-foreground/40">加载中…</p>
      </div>
    )
  }

  // 未登录时渲染空白，等待重定向
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />
      <main
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-6"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "var(--border) transparent",
        }}
      >
        {children}
      </main>
    </div>
  )
}
