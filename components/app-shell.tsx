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
