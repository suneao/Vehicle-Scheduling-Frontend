"use client"

import { usePathname } from "next/navigation"
import { Navbar } from "@/components/navbar"

const AUTH_PAGES = ["/login", "/register"]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (AUTH_PAGES.includes(pathname)) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />
      <main
        className="flex-1 overflow-y-auto px-8 pb-8 pt-4"
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
