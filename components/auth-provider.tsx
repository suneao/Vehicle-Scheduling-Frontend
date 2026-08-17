"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  login as apiLogin,
  logout as apiLogout,
  getToken,
  setToken,
  clearToken,
  decodeToken,
  isTokenExpired,
} from "@/lib/api"

// 开发模式：跳过登录鉴权，直接进入仪表盘
const DEV_MODE = false
const DEV_TOKEN = "dev-bypass-token"

interface AuthState {
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [state, setState] = React.useState<AuthState>({
    token: null,
    isAuthenticated: false,
    isLoading: true,
  })

  React.useEffect(() => {
    let cancelled = false
    const hydrate = () => {
      if (cancelled) return
      if (DEV_MODE) {
        setToken(DEV_TOKEN)
        setState({ token: DEV_TOKEN, isAuthenticated: true, isLoading: false })
        return
      }
      const token = getToken()
      // 已过期或无法解析的 token 直接清除，避免带着失效 token 渲染页面后接口返回 401 造成反复跳登录
      const badToken = token ? isTokenExpired(token) || !decodeToken(token) : false
      if (badToken) {
        console.info("[auth] hydrate: invalid/expired token cleared")
        clearToken()
        setState({ token: null, isAuthenticated: false, isLoading: false })
        return
      }
      console.info("[auth] hydrate:", { hasToken: !!token, expired: token ? isTokenExpired(token) : false })
      setState({
        token,
        isAuthenticated: !!token,
        isLoading: false,
      })
    }
    queueMicrotask(hydrate)
    return () => {
      cancelled = true
    }
  }, [])

  // 监听接口 401：清除 token 并跳转登录页（客户端跳转，不整页刷新）
  React.useEffect(() => {
    const onUnauthorized = () => {
      console.warn("[auth] unauthorized: 清除 token 并跳转登录")
      clearToken()
      setState({ token: null, isAuthenticated: false, isLoading: false })
      router.replace("/login")
    }
    window.addEventListener("auth:unauthorized", onUnauthorized)
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized)
  }, [router])

  const login = React.useCallback(
    async (username: string, password: string) => {
      if (DEV_MODE) {
        setToken(DEV_TOKEN)
        setState({ token: DEV_TOKEN, isAuthenticated: true, isLoading: false })
        router.push("/")
        return
      }
      const res = await apiLogin(username, password)
      const token = res?.data?.token
      if (!token) {
        console.error("[auth] login: no token in response", res)
        throw new Error("登录响应缺少 token，请联系管理员")
      }
      setToken(token)
      console.info("[auth] login success, token saved:", token.slice(0, 24) + "…")
      setState({ token, isAuthenticated: true, isLoading: false })
      router.push("/")
    },
    [router]
  )

  const logout = React.useCallback(async () => {
    if (!DEV_MODE) {
      try {
        await apiLogout()
      } catch {
        // 忽略登出接口错误
      }
    }
    clearToken()
    setState({ token: null, isAuthenticated: false, isLoading: false })
    router.push("/login")
  }, [router])

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return ctx
}
