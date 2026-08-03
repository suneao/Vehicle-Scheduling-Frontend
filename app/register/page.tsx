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
import { sendCode, register } from "@/lib/api"
import { UserPlusIcon, MailIcon } from "lucide-react"

export default function RegisterPage() {
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [nickname, setNickname] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [code, setCode] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [sendingCode, setSendingCode] = React.useState(false)
  const [countdown, setCountdown] = React.useState(0)

  // 发送验证码倒计时
  React.useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  async function handleSendCode() {
    if (!email.trim()) {
      toast.error("请先输入邮箱地址")
      return
    }
    setSendingCode(true)
    try {
      await sendCode("register", email)
      toast.success("验证码已发送")
      setCountdown(60)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "发送验证码失败"
      toast.error(msg)
    } finally {
      setSendingCode(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim() || !email.trim() || !nickname.trim() || !password) {
      toast.error("请填写所有必填字段")
      return
    }
    if (password !== confirmPassword) {
      toast.error("两次输入的密码不一致")
      return
    }
    if (password.length < 6) {
      toast.error("密码长度不能少于6位")
      return
    }
    if (!code.trim()) {
      toast.error("请输入验证码")
      return
    }

    setLoading(true)
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        nickname: nickname.trim(),
        password,
        address: [],
        code: code.trim(),
      })
      toast.success("注册成功，请登录")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "注册失败"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>注册</CardTitle>
          <CardDescription>
            创建车辆调度管理系统账号
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-3">
            <Input
              type="text"
              placeholder="用户名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoComplete="username"
            />
            <Input
              type="text"
              placeholder="昵称"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={loading}
            />
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSendCode}
                disabled={sendingCode || countdown > 0 || loading}
                className="shrink-0"
              >
                {countdown > 0 ? (
                  `${countdown}s`
                ) : sendingCode ? (
                  "发送中..."
                ) : (
                  <>
                    <MailIcon data-icon="inline-start" />
                    获取验证码
                  </>
                )}
              </Button>
            </div>
            <Input
              type="text"
              placeholder="邮箱验证码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={loading}
              maxLength={6}
            />
            <Input
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />
            <Input
              type="password"
              placeholder="确认密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                "注册中..."
              ) : (
                <>
                  <UserPlusIcon data-icon="inline-start" />
                  注册
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              已有账号？
              <Link
                href="/login"
                className="ml-1 text-primary hover:underline"
              >
                登录
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
