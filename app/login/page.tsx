"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { useAuth } from "@/components/auth-provider"
import { LogInIcon } from "lucide-react"

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) {
      toast.error("请填写用户名和密码")
      return
    }
    setLoading(true)
    try {
      await login(username, password)
      toast.success("登录成功")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "登录失败，请检查用户名和密码"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>登录</CardTitle>
          <CardDescription>
            车辆调度管理系统
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-3">
            <Input
              type="text"
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
            />
            <Input
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                "登录中..."
              ) : (
                <>
                  <LogInIcon data-icon="inline-start" />
                  登录
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              还没有账号？
              <Link
                href="/register"
                className="ml-1 text-primary hover:underline"
              >
                注册
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
