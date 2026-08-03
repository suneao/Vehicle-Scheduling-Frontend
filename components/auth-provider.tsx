"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  login as apiLogin,
  logout as apiLogout,
  getToken,
  setToken,
  clearToken,
} from "@/lib/api"

// 开发模式：后端登录接口暂不可用时，跳过鉴权
const DEV_MODE = true

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
    if (DEV_MODE) {
      // 开发模式：自动设置模拟 token
      setToken("dev-token")
      setState({ token: "dev-token", isAuthenticated: true, isLoading: false })
      return
    }
    const token = getToken()
    setState({
      token,
      isAuthenticated: !!token,
      isLoading: false,
    })
  }, [])

  const login = React.useCallback(
    async (username: string, password: string) => {
      if (DEV_MODE) {
        setToken("dev-token")
        setState({ token: "dev-token", isAuthenticated: true, isLoading: false })
        router.push("/")
        return
      }
      const res = await apiLogin(username, password)
      const token = res.data.access_token
      setToken(token)
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
