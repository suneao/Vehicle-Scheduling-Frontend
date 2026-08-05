"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  adminGetUserList,
  adminUserUpdate,
  adminUserDelete,
  commonsGetUserInfo,
  getCurrentUser,
  oauthSendCode,
  oauthRegister,
  oauthForget,
  type UserInfo,
  type UserListItem,
  type UserUpdateParams,
} from "@/lib/api"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  UserIcon,
  MailIcon,
  PhoneIcon,
  CalendarIcon,
  ActivityIcon,
  ShieldIcon,
  PlusIcon,
  EyeIcon,
  PencilIcon,
  Trash2Icon,
  RefreshCwIcon,
  LockIcon,
  CrownIcon,
  KeyRoundIcon,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

export default function AccountPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()

  // 当前用户身份（从 token 解码，不依赖 userinfo 接口）
  const me = getCurrentUser()
  const isAdmin = me?.isAdmin ?? false

  const [users, setUsers] = React.useState<UserListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)

  // 详情
  const [detailUser, setDetailUser] = React.useState<UserInfo | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)

  // 对话框
  const [createOpen, setCreateOpen] = React.useState(false)
  const [passwordOpen, setPasswordOpen] = React.useState(false)
  const [editUser, setEditUser] = React.useState<UserInfo | null>(null)
  const [deleting, setDeleting] = React.useState<number | null>(null)

  // 鉴权守卫
  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login")
    }
  }, [authLoading, isAuthenticated, router])

  // 加载用户列表（token 解码的身份插入顶部）
  async function loadUsers() {
    // 初始 loading 已是 true；刷新时用 refreshing 状态，无需同步 setState
    try {
      const listRes = await adminGetUserList()
      let list = listRes.data as UserListItem[]

      // 从 token 获取当前身份，插入顶部（后端列表不含当前账户）
      if (me?.id != null) {
        list = [
          { id: me.id, name: me.name ?? "我" },
          ...list.filter((u) => u.id !== me.id),
        ]
      }
      setUsers(list)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "获取用户列表失败")
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    adminGetUserList()
      .then((listRes) => {
        if (cancelled) return
        let list = listRes.data as UserListItem[]
        // 从 token 获取当前身份，插入顶部（后端列表不含当前账户）
        if (me?.id != null) {
          list = [
            { id: me.id, name: me.name ?? "我" },
            ...list.filter((u) => u.id !== me.id),
          ]
        }
        setUsers(list)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "获取用户列表失败")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  // 查看详情（任意用户详情，userinfo 带 user_id 参数）
  async function showDetail(id: number) {
    setDetailLoading(true)
    try {
      const res = await commonsGetUserInfo(id)
      setDetailUser(res.data)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "获取用户详情失败")
    } finally {
      setDetailLoading(false)
    }
  }

  // 权限：管理员可操作所有人；普通用户只能操作自己
  function canManage(u: UserListItem): boolean {
    return isAdmin || u.id === me?.id
  }

  // 删除用户
  async function handleDelete(u: UserListItem) {
    if (!canManage(u)) {
      toast.error("无权限删除该账户")
      return
    }
    if (!confirm(`确认删除用户「${u.name}」(ID: ${u.id})？该操作不可撤销`)) return
    setDeleting(u.id)
    try {
      await adminUserDelete(u.id)
      toast.success(`用户 ${u.name} 已删除`)
      loadUsers()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "删除失败")
    } finally {
      setDeleting(null)
    }
  }

  // 打开编辑（管理员任意用户；普通用户仅自己）
  async function openEdit(u: UserListItem) {
    if (!canManage(u)) {
      toast.error("无权限编辑该账户")
      return
    }
    try {
      const res = await commonsGetUserInfo(u.id)
      setEditUser(res.data)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "获取用户详情失败")
    }
  }

  if (authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-xs text-muted-foreground/40">加载中…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      {/* 顶部 */}
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-sm font-medium">
            <UserIcon className="size-4 text-primary" />
            账户管理
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground/50">
            共 {users.length} 个账户
            {isAdmin ? (
              <Badge className="text-[10px]">
                <CrownIcon className="mr-0.5 size-2.5" />
                管理员
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">
                <LockIcon className="mr-0.5 size-2.5" />
                仅可管理本人
              </Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={() => setPasswordOpen(true)}
          >
            <KeyRoundIcon className="size-3" />
            修改密码
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => { setRefreshing(true); loadUsers().finally(() => setRefreshing(false)) }}
            disabled={refreshing}
          >
            <RefreshCwIcon className={cn("size-3", refreshing && "animate-spin")} />
            刷新
          </Button>
          <Button size="xs" onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            创建用户
          </Button>
        </div>
      </div>

      {/* 用户列表 */}
      <Card className="flex flex-col" style={{ minHeight: 0 }}>
        <CardHeader className="shrink-0 border-b">
          <CardTitle className="text-xs">全部账户</CardTitle>
          <CardDescription>
            {isAdmin
              ? "管理员：可编辑、删除所有账户"
              : "普通账户：仅可编辑、删除自己的账户"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0" style={{ minHeight: 0 }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-xs text-muted-foreground/40">加载中…</p>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted/20 ring-1 ring-border/10">
                <UserIcon className="size-5 text-muted-foreground/20" />
              </div>
              <p className="text-xs text-muted-foreground/50">暂无用户</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* 表头 */}
              <div className="flex items-center gap-3 border-b border-border/10 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                <span className="w-12 shrink-0">ID</span>
                <span className="flex-1">用户名</span>
                <span className="shrink-0">操作</span>
              </div>
              {/* 行 */}
              {users.map((u) => {
                const isMe = u.id === me?.id
                const manage = canManage(u)
                return (
                  <div
                    key={u.id}
                    className={cn(
                      "flex items-center gap-3 border-b border-border/5 px-4 py-2.5 text-xs transition-colors",
                      isMe ? "bg-primary/5" : "hover:bg-muted/20"
                    )}
                  >
                    <span className="w-12 shrink-0 font-mono text-muted-foreground/50 tabular-nums">
                      {u.id}
                    </span>
                    <span className="flex flex-1 items-center gap-2 truncate font-medium">
                      {u.name}
                      {isMe && <Badge className="shrink-0 text-[10px]">当前</Badge>}
                      {!manage && !isMe && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          只读
                        </Badge>
                      )}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <IconButton title="查看详情" onClick={() => showDetail(u.id)}>
                        <EyeIcon className="size-3.5" />
                      </IconButton>
                      <IconButton
                        title={manage ? "编辑" : "无权限编辑"}
                        disabled={!manage}
                        onClick={() => openEdit(u)}
                      >
                        <PencilIcon className="size-3.5" />
                      </IconButton>
                      <IconButton
                        title={manage ? "删除" : "无权限删除"}
                        danger
                        disabled={!manage || deleting === u.id}
                        onClick={() => handleDelete(u)}
                      >
                        <Trash2Icon className="size-3.5" />
                      </IconButton>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== 详情对话框 ===== */}
      <Dialog open={!!detailUser} onOpenChange={(o) => { if (!o) setDetailUser(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <UserIcon className="size-4 text-primary" />
              用户 #{detailUser?.id} · {detailUser?.name}
            </DialogTitle>
            <DialogDescription>账户详细信息</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <p className="py-8 text-center text-xs text-muted-foreground/40">加载中…</p>
          ) : detailUser ? (
            <div className="flex flex-col gap-1">
              <DetailRow icon={MailIcon} label="邮箱">{detailUser.email}</DetailRow>
              <DetailRow icon={PhoneIcon} label="电话">
                {detailUser.phone ? String(detailUser.phone) : "未设置"}
              </DetailRow>
              <DetailRow icon={ShieldIcon} label="角色">
                <div className="flex items-center gap-1.5">
                  {(detailUser.roles ?? []).includes("admin") ? (
                    <Badge className="text-[10px]">管理员</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">普通用户</Badge>
                  )}
                </div>
              </DetailRow>
              <DetailRow icon={CalendarIcon} label="注册">
                {detailUser.create_time ? new Date(detailUser.create_time).toLocaleString("zh-CN") : "—"}
              </DetailRow>
              <DetailRow icon={ActivityIcon} label="活跃">
                {detailUser.last_active_time ? new Date(detailUser.last_active_time).toLocaleString("zh-CN") : "—"}
              </DetailRow>
              <DetailRow icon={ActivityIcon} label="状态">
                <Badge variant={detailUser.isActive ? "default" : "secondary"} className="text-[10px]">
                  {detailUser.isActive ? "启用" : "停用"}
                </Badge>
              </DetailRow>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDetailUser(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 创建用户对话框 ===== */}
      <CreateUserDialog
        key={createOpen ? "open" : "closed"}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => { loadUsers(); setCreateOpen(false) }}
      />

      {/* ===== 修改密码对话框 ===== */}
      <ChangePasswordDialog
        key={passwordOpen ? "open" : "closed"}
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
      />

      {/* ===== 编辑用户对话框 ===== */}
      <EditUserDialog
        key={editUser?.id ?? "closed"}
        user={editUser}
        isAdmin={isAdmin}
        onClose={() => setEditUser(null)}
        onSaved={() => { loadUsers(); setEditUser(null) }}
      />
    </div>
  )
}

/* ==================== 子组件 ==================== */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
      {children}
    </p>
  )
}

/** 带完整标签的表单字段（输入框有值时仍可识别字段名） */
function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground/70">{label}</span>
      {children}
    </label>
  )
}

function IconButton({
  title,
  danger,
  disabled,
  onClick,
  children,
}: {
  title: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-6 items-center justify-center rounded text-muted-foreground/40 transition-colors",
        disabled
          ? "cursor-not-allowed opacity-30"
          : "hover:bg-muted hover:text-foreground",
        !disabled && danger && "hover:text-destructive"
      )}
    >
      {children}
    </button>
  )
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 py-1 text-xs">
      <Icon className="size-3.5 shrink-0 text-muted-foreground/40" />
      <span className="w-8 shrink-0 text-muted-foreground/50">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-foreground/80">{children}</span>
    </div>
  )
}

/* ==================== 创建用户 ==================== */

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: () => void
}) {
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [nickname, setNickname] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [code, setCode] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [countdown, setCountdown] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  async function handleSendCode() {
    if (!email.trim()) { toast.error("请先输入邮箱"); return }
    setSending(true)
    try {
      await oauthSendCode("register", email)
      toast.success("验证码已发送")
      setCountdown(60)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "发送失败")
    } finally {
      setSending(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !nickname.trim() || !password || !code.trim()) {
      toast.error("请填写所有必填字段")
      return
    }
    if (password.length < 6) { toast.error("密码长度不能少于 6 位"); return }
    setSubmitting(true)
    try {
      await oauthRegister({
        name: name.trim(),
        email: email.trim(),
        nickname: nickname.trim(),
        password,
        address: [],
        code: code.trim(),
      })
      toast.success(`用户 ${name} 创建成功`)
      onCreated()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "创建失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <PlusIcon className="size-4 text-primary" />
            创建用户
          </DialogTitle>
          <DialogDescription>需要邮箱验证码完成注册</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="用户名">
            <Input placeholder="请输入用户名" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} />
          </Field>
          <Field label="昵称">
            <Input placeholder="请输入昵称" value={nickname} onChange={(e) => setNickname(e.target.value)} disabled={submitting} />
          </Field>
          <Field label="邮箱">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="请输入邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSendCode}
                disabled={sending || countdown > 0 || submitting}
                className="shrink-0"
              >
                {countdown > 0 ? `${countdown}s` : sending ? "发送中…" : "获取验证码"}
              </Button>
            </div>
          </Field>
          <Field label="邮箱验证码">
            <Input placeholder="请输入验证码" value={code} onChange={(e) => setCode(e.target.value)} disabled={submitting} maxLength={6} />
          </Field>
          <Field label="初始密码">
            <Input type="password" placeholder="请输入初始密码（至少 6 位）" value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "创建中…" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ==================== 修改密码 ==================== */

function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [email, setEmail] = React.useState("")
  const [code, setCode] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [countdown, setCountdown] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  async function handleSendCode() {
    if (!email.trim()) { toast.error("请先输入邮箱"); return }
    setSending(true)
    try {
      await oauthSendCode("forget", email)
      toast.success("验证码已发送")
      setCountdown(60)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "发送失败")
    } finally {
      setSending(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !code.trim() || !newPassword) {
      toast.error("请填写邮箱、验证码和新密码")
      return
    }
    if (newPassword.length < 6) {
      toast.error("新密码长度不能少于 6 位")
      return
    }
    setSubmitting(true)
    try {
      await oauthForget({
        new_password: newPassword,
        email: email.trim(),
        valid_code: code.trim(),
      })
      toast.success("密码修改成功")
      setCode("")
      setNewPassword("")
      onOpenChange(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "密码修改失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <KeyRoundIcon className="size-4 text-primary" />
            修改密码
          </DialogTitle>
          <DialogDescription>通过邮箱验证码重置密码</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="邮箱">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="请输入邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSendCode}
                disabled={sending || countdown > 0 || submitting}
                className="shrink-0"
              >
                {countdown > 0 ? `${countdown}s` : sending ? "发送中…" : "获取验证码"}
              </Button>
            </div>
          </Field>
          <Field label="邮箱验证码">
            <Input
              placeholder="请输入验证码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={submitting}
              maxLength={6}
            />
          </Field>
          <Field label="新密码">
            <Input
              type="password"
              placeholder="请输入新密码（至少 6 位）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
              autoComplete="new-password"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "提交中…" : "确认修改"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ==================== 编辑用户 ==================== */

function EditUserDialog({
  user,
  isAdmin,
  onClose,
  onSaved,
}: {
  user: UserInfo | null
  isAdmin: boolean
  onClose: () => void
  onSaved: () => void
}) {
  // 通过父组件 key 强制重新挂载，初始 state 直接从 user 派生
  const [name, setName] = React.useState(user?.name ?? "")
  const [nickname, setNickname] = React.useState(user?.nickname ?? "")
  const [phone, setPhone] = React.useState(user?.phone ? String(user.phone) : "")
  const [email, setEmail] = React.useState(user?.email ?? "")
  const [isActive, setIsActive] = React.useState(user?.isActive ?? true)
  const [setAsAdmin, setSetAsAdmin] = React.useState(
    (user?.roles ?? []).includes("admin")
  )
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitting(true)
    try {
      const params: UserUpdateParams = { name, nickname, email, phone }
      if (isAdmin) {
        params.isActive = isActive
        params.isAdmin = setAsAdmin
      }
      const res = await adminUserUpdate(user.id, params)
      // PUT 响应回显完整用户（含真实 isAdmin），用它更新开关并提示结果
      const updated = res.data
      if (isAdmin && updated?.isAdmin !== undefined) {
        setSetAsAdmin(updated.isAdmin)
        toast.success(
          updated.isAdmin
            ? `已授予 ${user.name} 管理员权限`
            : `已取消 ${user.name} 的管理员权限`
        )
      } else {
        toast.success(`用户 ${user.name} 已更新`)
      }
      onSaved()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "更新失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <PencilIcon className="size-4 text-primary" />
            编辑用户 · {user?.name}
          </DialogTitle>
          <DialogDescription>
            {isAdmin ? "管理员可修改全部字段" : "仅可编辑自己的基本信息"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="用户名">
            <Input placeholder="请输入用户名" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} />
          </Field>
          <Field label="昵称">
            <Input placeholder="请输入昵称" value={nickname} onChange={(e) => setNickname(e.target.value)} disabled={submitting} />
          </Field>
          <Field label="电话">
            <Input placeholder="请输入电话号码" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={submitting} />
          </Field>
          <Field label="邮箱">
            <Input type="email" placeholder="请输入邮箱地址" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} />
          </Field>

          {isAdmin && (
            <>
              <Separator />
              <FieldLabel>账户权限</FieldLabel>
              <label className="flex cursor-pointer items-center justify-between text-xs">
                <span className="text-muted-foreground/60">启用账户</span>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={submitting}
                  className="size-3.5 accent-(--color-primary)"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between text-xs">
                <span className="text-muted-foreground/60">设置为管理员</span>
                <input
                  type="checkbox"
                  checked={setAsAdmin}
                  onChange={(e) => setSetAsAdmin(e.target.checked)}
                  disabled={submitting}
                  className="size-3.5 accent-(--color-primary)"
                />
              </label>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>取消</Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
