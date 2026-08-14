/**
 * API 接口汇总
 * 基于 OpenAPI 文档：http://39.108.77.178:8001/docs
 * 所有接口按模块分类，统一管理，方便调用和修改
 */

import { VIRTUAL_VEHICLES_ENABLED, getVirtualCarPositions } from "@/lib/virtual-vehicles"
import { getRouteMapForVehicles } from "@/lib/route-assignments"

// ==================== 基础配置 ====================

// 通过 Next.js rewrites 代理，避免跨域
const BASE_URL = ""
const TOKEN_KEY = "auth_token"

// ==================== Token 管理 ====================

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

/** JWT token 解码（不校验签名，仅读取 payload） */
export function decodeToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".")
    if (parts.length < 2) return null
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=")
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** 从当前 token 获取身份信息（id / name / isAdmin），失败返回 null */
export function getCurrentUser(): { id?: number; name?: string; isAdmin?: boolean } | null {
  const token = getToken()
  if (!token) return null
  const payload = decodeToken(token)
  if (!payload) return null
  return {
    id: typeof payload.id === "number" ? payload.id : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
    isAdmin: payload.isAdmin === true,
  }
}

// ==================== 响应类型 ====================

export interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

export class ApiError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
    this.name = "ApiError"
  }
}

// ==================== 请求封装 ====================

/**
 * 统一请求方法
 * - 自动携带 Bearer token（免鉴权接口除外）
 * - 401 自动清除 token 并跳转登录页
 * - 4xx/5xx 自动解析错误信息
 */
export async function request<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${endpoint}`
  const token = getToken()

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  // 免鉴权接口列表
  const publicEndpoints = [
    "/api/oauth/login",
    "/api/oauth/register",
    "/api/oauth/getcode",
    "/api/oauth/forget",
    "/api/admin/cars/position/upload",
    "/api/admin/cars/position/all",
    "/api/test/login",
  ]
  const isPublic = publicEndpoints.some((p) => endpoint.startsWith(p))

  if (token && !isPublic) {
    headers["Authorization"] = `Bearer ${token}`
  }

  if (options.method && options.method !== "GET" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json"
  }

  const res = await fetch(url, { ...options, headers })

  if (res.status === 401 && token) {
    clearToken()
    if (typeof window !== "undefined") window.location.href = "/login"
    throw new ApiError(401, "登录已过期，请重新登录")
  }

  if (res.status >= 400) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.detail || body.msg || "请求失败")
  }

  return res.json()
}

// ==================== 公共类型 ====================

/** 订单状态枚举 */
export enum OrderStatus {
  Pending = 0,
  Processing = 1,
  Completed = 2,
  Failed = 3,
  Cancelled = 4,
}

/** 登录响应 */
export interface LoginResult {
  token: string
  token_type: string
}

/** 用户信息 */
export interface UserInfo {
  id: number
  name: string
  nickname: string
  email: string
  phone?: number
  roles?: string[]
  address_id?: number
  create_time?: string
  last_active_time?: string
  isActive?: boolean
  isAdmin?: boolean
}

// ==================== 1. 认证模块 (OAuth) ====================

/** POST /api/oauth/login — 登录 */
export async function oauthLogin(username: string, password: string) {
  return request<LoginResult>(
    "/api/oauth/login",
    { method: "POST", body: JSON.stringify({ username, password }) }
  )
}

/** POST /api/oauth/logout — 登出 */
export async function oauthLogout() {
  return request("/api/oauth/logout", { method: "POST" })
}

/** POST /api/oauth/register — 注册 */
export async function oauthRegister(params: {
  name: string
  email: string
  nickname: string
  password: string
  address: number[]
  code: string
}) {
  return request("/api/oauth/register", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

/** GET /api/oauth/getcode/{path} — 发送邮箱验证码 */
export async function oauthSendCode(path: "register" | "forget", email: string) {
  return request(`/api/oauth/getcode/${path}?email=${encodeURIComponent(email)}`)
}

/** POST /api/oauth/forget — 忘记密码 */
export async function oauthForget(params: {
  new_password: string
  email: string
  valid_code: string
}) {
  return request("/api/oauth/forget", {
    method: "POST",
    body: JSON.stringify({
      new_password: { password: params.new_password },
      validData: {
        email: params.email,
        valid_code: params.valid_code,
      },
    }),
  })
}

// ==================== 2. 通用模块 (Common) ====================

/** GET /api/commons/userinfo — 获取用户信息 */
export async function commonsGetUserInfo(userId?: number) {
  const params = userId ? `?user_id=${userId}` : ""
  return request<UserInfo>(`/api/commons/userinfo${params}`)
}

/** GET /api/commons/maplist — 获取地图列表 */
export async function commonsGetMapList() {
  return request("/api/commons/maplist")
}

/** GET /api/commons/processlist — 获取工序列表 */
export async function commonsGetProcessList() {
  return request("/api/commons/processlist")
}

// ==================== 3. 车辆模块 (Admin Cars) ====================

/** ctl_code 控制指令枚举 */
export enum CtlCode {
  ACTIVATE = 0,
  PAUSE = 1,
  CONTINUE = 2,
  CANCEL = 3,
  INACTIVATE = 4,
}

/** POST /api/admin/cars/setStatus — 设置小车运行状态 */
export async function carsSetStatus(carId: number, ctlCode: CtlCode) {
  return request(
    `/api/admin/cars/setStatus?car_id=${carId}&ctl_code=${ctlCode}`,
    { method: "POST" }
  )
}

/** POST /api/admin/cars/runDemo — 启动演示轨迹任务 */
export async function carsRunDemo(taskId: number, carId = 1) {
  return request(
    `/api/admin/cars/runDemo?taskId=${taskId}&car_id=${carId}`,
    { method: "POST" }
  )
}

/** POST /api/admin/cars/processImage — 车载图像识别 */
export async function carsProcessImage(uploadImage?: File) {
  const formData = new FormData()
  if (uploadImage) {
    formData.append("uploadImage", uploadImage)
  }
  return request("/api/admin/cars/processImage", {
    method: "POST",
    headers: {}, // 让浏览器自动设置 multipart boundary
    body: formData,
  })
}

/** 小车位置数据 */
export interface CarPosition {
  car_id: number
  x: number
  y: number
  speed: number
  angle?: number
  /** 电量百分比 0-100（后端未提供时为 undefined） */
  battery?: number
  /** 类型：vehicle = 车辆；robot = 机器狗（后端未提供时为 undefined，默认按车辆处理） */
  kind?: "vehicle" | "robot"
  update_time?: string
}

/** POST /api/admin/cars/position/upload — 上报小车位置（免鉴权） */
export async function carsUploadPosition(position: {
  car_id: number
  x: number
  y: number
  speed: number
}) {
  return request<CarPosition>("/api/admin/cars/position/upload", {
    method: "POST",
    body: JSON.stringify(position),
  })
}

/** GET /api/admin/cars/position/all — 获取全部小车实时位置（免鉴权） */
export async function carsGetAllPositions() {
  // 2 秒超时：后端不可用时避免轮询挂起，前端测试模式兜底返回虚拟小车
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2000)
  try {
    const res = await request<Record<string, CarPosition>>(
      "/api/admin/cars/position/all",
      { signal: controller.signal }
    )
    // 真实车辆为空时注入虚拟小车（前端测试用）；有路线分配的车辆沿路线行走
    const data = res.data ?? {}
    if (Object.keys(data).length === 0 && VIRTUAL_VEHICLES_ENABLED) {
      return { ...res, data: getVirtualCarPositions(getRouteMapForVehicles()) }
    }
    return res
  } catch {
    // 请求失败/超时：测试模式下仍返回实时虚拟小车
    if (VIRTUAL_VEHICLES_ENABLED) {
      return {
        code: 200,
        msg: "虚拟小车",
        data: getVirtualCarPositions(getRouteMapForVehicles()),
      }
    }
    throw new Error("获取车辆位置失败")
  } finally {
    clearTimeout(timer)
  }
}

// ==================== 4. 订单模块 (Admin Orders) ====================

export interface CreateOrderParams {
  name: string
  create_time: string
  description: string
  user_id: number
  item_id: number
}

export interface UpdateOrderParams {
  id: number
  name?: string
  isEditing?: boolean
  start_time?: string
  end_time?: string
  description?: string
  task_description?: string
  reject_or_fail_reason?: string
  IsShowToClient?: boolean
  task_id?: number
  item_id?: number
  status?: OrderStatus
}

export interface QueryOrderParams {
  page?: number
  limit?: number
  desc?: boolean
  timeDesc?: boolean
  item_id?: number[]
  editState?: boolean[]
  orderState?: OrderStatus[]
  IsShowToClient?: boolean[]
  user_id?: number[]
}

/** POST /api/admin/order/create — 创建订单 */
export async function adminOrderCreate(params: CreateOrderParams) {
  return request("/api/admin/order/create", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

/** POST /api/admin/order/update — 更新订单 */
export async function adminOrderUpdate(params: UpdateOrderParams) {
  return request("/api/admin/order/update", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

/** POST /api/admin/order/getlist — 获取订单列表 */
export async function adminOrderGetList(params: QueryOrderParams) {
  return request("/api/admin/order/getlist", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

/** DELETE /api/admin/order/delete — 删除订单 */
export async function adminOrderDelete(orderId: number) {
  return request(`/api/admin/order/delete?order_id=${orderId}`, {
    method: "DELETE",
  })
}

// ==================== 5. 物料模块 (Admin Items) ====================

export interface QueryItemsParams {
  query: string
  pagenum: number
  pagesize: number
}

/** POST /api/admin/items/create — 添加物料 */
export async function adminItemsCreate(file: File) {
  const formData = new FormData()
  formData.append("file", file)
  return request("/api/admin/items/create", {
    method: "POST",
    headers: {},
    body: formData,
  })
}

/** GET /api/admin/items/getitems — 获取物料搜索列表 */
export async function adminItemsGetForSearch() {
  return request("/api/admin/items/getitems")
}

/** POST /api/admin/items/getitems — 查询物料 */
export async function adminItemsGetList(params: QueryItemsParams) {
  return request("/api/admin/items/getitems", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

/** DELETE /api/admin/items/delete — 删除物料 */
export async function adminItemsDelete(itemId: number) {
  return request(`/api/admin/items/delete?item_id=${itemId}`, {
    method: "DELETE",
  })
}

/** GET /api/admin/items/getitemprocess — 获取物料工序 */
export async function adminItemsGetProcess(itemId: number) {
  return request(
    `/api/admin/items/getitemprocess?item_id=${itemId}`
  )
}

// ==================== 6. 用户管理模块 (Admin Users) ====================

/** 用户列表项 */
export interface UserListItem {
  id: number
  name: string
}

/** 用户更新参数 */
export interface UserUpdateParams {
  name?: string
  nickname?: string
  email?: string
  phone?: string
  isActive?: boolean
  isAdmin?: boolean
  address_id?: number
}

/** GET /api/admin/user/getuserlist — 获取用户列表 */
export async function adminGetUserList() {
  return request<UserListItem[]>("/api/admin/user/getuserlist")
}

/** PUT /api/admin/user/{user_id} — 管理员修改指定用户信息，返回修改后的完整用户 */
export async function adminUserUpdate(userId: number, params: UserUpdateParams) {
  return request<UserInfo>(`/api/admin/user/${userId}`, {
    method: "PUT",
    body: JSON.stringify(params),
  })
}

/** DELETE /api/admin/user/{user_id} — 管理员删除指定用户账号 */
export async function adminUserDelete(userId: number) {
  return request(`/api/admin/user/${userId}`, {
    method: "DELETE",
  })
}

// ==================== 7. 客户端订单模块 (Client Orders) ====================

/** POST /api/client/order/create — 客户端创建订单 */
export async function clientOrderCreate(params: CreateOrderParams) {
  return request("/api/client/order/create", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

/** POST /api/client/order/update — 客户端更新订单 */
export async function clientOrderUpdate(params: UpdateOrderParams) {
  return request("/api/client/order/update", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

/** POST /api/client/order/getlist — 客户端获取订单列表 */
export async function clientOrderGetList(params: QueryOrderParams) {
  return request("/api/client/order/getlist", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

/** DELETE /api/client/order/delete — 客户端删除订单 */
export async function clientOrderDelete(orderId: number) {
  return request(`/api/client/order/delete?order_id=${orderId}`, {
    method: "DELETE",
  })
}

// ==================== 8. 客户端物料模块 (Client Items) ====================

/** POST /api/client/items/create — 客户端添加物料 */
export async function clientItemsCreate(file: File) {
  const formData = new FormData()
  formData.append("file", file)
  return request("/api/client/items/create", {
    method: "POST",
    headers: {},
    body: formData,
  })
}

/** GET /api/client/items/getitems — 客户端获取物料搜索列表 */
export async function clientItemsGetForSearch() {
  return request("/api/client/items/getitems")
}

/** POST /api/client/items/getitems — 客户端查询物料 */
export async function clientItemsGetList(params: QueryItemsParams) {
  return request("/api/client/items/getitems", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

/** DELETE /api/client/items/delete — 客户端删除物料 */
export async function clientItemsDelete(itemId: number) {
  return request(`/api/client/items/delete?item_id=${itemId}`, {
    method: "DELETE",
  })
}

/** GET /api/client/items/getitemprocess — 客户端获取物料工序 */
export async function clientItemsGetProcess(itemId: number) {
  return request(
    `/api/client/items/getitemprocess?item_id=${itemId}`
  )
}

// ==================== 9. 测试模块 (Test) ====================

/** POST /api/test/ — Hello World */
export async function testHello(name: string) {
  return request("/api/test/", {
    method: "POST",
    body: JSON.stringify({ name }),
  })
}

/** GET /api/test/user — 获取测试用户信息 */
export async function testGetUserInfo() {
  return request("/api/test/user")
}

/** POST /api/test/login — 兼容 OAuth2 的令牌登录（form-urlencoded） */
export async function testLogin(username: string, password: string) {
  const body = new URLSearchParams({
    username,
    password,
    grant_type: "password",
  })
  return request<{ access_token: string; token_type: string }>("/api/test/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
}

// ==================== 便捷导出：兼容旧版简写 ====================

export const login = oauthLogin
export const logout = oauthLogout
export const register = oauthRegister
export const sendCode = oauthSendCode
