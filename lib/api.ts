/**
 * API 接口汇总
 * 基于 OpenAPI 文档：http://39.108.77.178:8001/docs
 * 所有接口按模块分类，统一管理，方便调用和修改
 */

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

/** 判断 token 是否已过期（exp 为秒级时间戳） */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token)
  if (!payload || typeof payload.exp !== "number") return false
  return payload.exp * 1000 <= Date.now()
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
    "/report/car_status",
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
    if (typeof window !== "undefined") {
      console.warn(`[api] ${options.method ?? "GET"} ${endpoint} -> 401 正在清除 token 并跳转登录`)
      // 先通知应用更新鉴权状态（客户端跳转，不清控制台）
      window.dispatchEvent(new CustomEvent("auth:unauthorized"))
      // 兜底：若事件监听未及时处理，强制整页跳转，避免停留在假登录态
      setTimeout(() => {
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.href = "/login"
        }
      }, 1500)
    }
    clearToken()
    throw new ApiError(401, "登录已过期，请重新登录")
  }

  if (res.status >= 400) {
    const body = await res.json().catch(() => ({}))
    // 调试日志：定位哪个接口返回了非 2xx
    if (typeof window !== "undefined") {
      console.warn(`[api] ${options.method ?? "GET"} ${endpoint} -> ${res.status}`, body)
    }
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

// ==================== 3. 车辆模块 (Cars) ====================

/** 车辆控制指令（对应后端 CarCommandIn.command） */
export type CarCommand = "start" | "stop" | "pause" | "resume" | "goto"

/** POST /api/cars/{car_id}/command — 下发控制指令 */
export async function carsSendCommand(
  carId: number,
  command: CarCommand,
  pathId?: number,
  params?: Record<string, unknown>
) {
  return request(`/api/cars/${carId}/command`, {
    method: "POST",
    body: JSON.stringify({ command, path_id: pathId, params }),
  })
}

/** 小车位置数据（对齐后端 /api/cars/list 返回结构） */
export interface CarPosition {
  car_id: number
  name?: string
  /** 运行状态（后端 status 字段，具体语义以后端为准） */
  status?: number
  /** 经度 */
  lon: number
  /** 纬度 */
  lat: number
  /** 航向角（度） */
  yaw?: number
  /** 速度（m/s） */
  speed: number
  /** 电量百分比 0-100（后端未提供时为 undefined） */
  battery?: number
  /** 类型：vehicle = 车辆；robot = 机器狗（后端暂未提供，预留字段） */
  kind?: "vehicle" | "robot"
  /** 视频流地址（可选） */
  video_streams?: Record<string, string>
}

/** GET /api/cars/list — 获取全部小车完整信息（含 GPS 经纬度/航向/电量，需鉴权） */
export async function carsGetAllPositions(): Promise<ApiResponse<CarPosition[]>> {
  // 2 秒超时：后端不可用时避免轮询挂起，返回空结果
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2000)
  try {
    return await request<CarPosition[]>("/api/cars/list", {
      signal: controller.signal,
    })
  } catch {
    // 请求失败/超时：返回空结果，交由页面显示「无车辆/机器狗连接」
    return {
      code: 200,
      msg: "车辆位置获取失败",
      data: [],
    }
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

/** POST /api/order/create — 创建订单 */
export async function adminOrderCreate(params: CreateOrderParams) {
  return request("/api/order/create", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

/** POST /api/order/update — 更新订单 */
export async function adminOrderUpdate(params: UpdateOrderParams) {
  return request("/api/order/update", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

/** POST /api/order/getlist — 获取订单列表 */
export async function adminOrderGetList(params: QueryOrderParams) {
  return request("/api/order/getlist", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

/** DELETE /api/order/delete — 删除订单 */
export async function adminOrderDelete(orderId: number) {
  return request(`/api/order/delete?order_id=${orderId}`, {
    method: "DELETE",
  })
}

// ==================== 5. 物料模块 (Admin Items) ====================

export interface QueryItemsParams {
  query: string
  pagenum: number
  pagesize: number
}

/** POST /api/items/create — 添加物料 */
export async function adminItemsCreate(file: File) {
  const formData = new FormData()
  formData.append("file", file)
  return request("/api/items/create", {
    method: "POST",
    headers: {},
    body: formData,
  })
}

/** GET /api/items/getitems — 获取物料搜索列表 */
export async function adminItemsGetForSearch() {
  return request("/api/items/getitems")
}

/** POST /api/items/getitems — 查询物料 */
export async function adminItemsGetList(params: QueryItemsParams) {
  return request("/api/items/getitems", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

/** DELETE /api/items/delete — 删除物料 */
export async function adminItemsDelete(itemId: number) {
  return request(`/api/items/delete?item_id=${itemId}`, {
    method: "DELETE",
  })
}

/** GET /api/items/getitemprocess — 获取物料工序 */
export async function adminItemsGetProcess(itemId: number) {
  return request(
    `/api/items/getitemprocess?item_id=${itemId}`
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

/** GET /api/user/getuserlist — 获取用户列表 */
export async function adminGetUserList() {
  return request<UserListItem[]>("/api/user/getuserlist")
}

/** PUT /api/user/{user_id} — 管理员修改指定用户信息，返回修改后的完整用户 */
export async function adminUserUpdate(userId: number, params: UserUpdateParams) {
  return request<UserInfo>(`/api/user/${userId}`, {
    method: "PUT",
    body: JSON.stringify(params),
  })
}

/** DELETE /api/user/{user_id} — 管理员删除指定用户账号 */
export async function adminUserDelete(userId: number) {
  return request(`/api/user/${userId}`, {
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

// ==================== 10. 路线/站点/途经点模块 (Admin Paths/Sites/Waypoints) ====================

/** 路线节点引用（site = 站点，waypoint = 途经点） */
export interface PathNodeRef {
  type: "site" | "waypoint"
  id: number
}

/** 后端路线记录 */
export interface PathRecord {
  id: number
  name: string
  path_type: string
  node_chain: PathNodeRef[]
  car_id?: number
  created_at?: string
}

export interface PathCreatePayload {
  name: string
  path_type: string
  node_chain: PathNodeRef[]
  car_id?: number
}

export interface PathUpdatePayload {
  name?: string
  path_type?: string
  node_chain?: PathNodeRef[]
  car_id?: number
}

/** 后端站点记录 */
export interface SiteRecord {
  id: number
  name: string
  lon: number
  lat: number
  dwell_time?: number
  description?: string | null
  created_at?: string
}

export interface SiteCreatePayload {
  name: string
  lon: number
  lat: number
  dwell_time?: number
  description?: string
}

export interface SiteUpdatePayload {
  name?: string
  lon?: number
  lat?: number
  dwell_time?: number
  description?: string
}

/** 后端途经点记录 */
export interface WaypointRecord {
  id: number
  name: string
  lon: number
  lat: number
  description?: string | null
  created_at?: string
}

export interface WaypointCreatePayload {
  name: string
  lon: number
  lat: number
  description?: string
}

export interface WaypointUpdatePayload {
  name?: string
  lon?: number
  lat?: number
  description?: string
}

/** GET /admin/paths/ — 获取所有路线（可筛选类型或小车） */
export async function pathsList(params?: { path_type?: string; car_id?: number }) {
  const query = new URLSearchParams()
  if (params?.path_type) query.set("path_type", params.path_type)
  if (params?.car_id != null) query.set("car_id", String(params.car_id))
  const qs = query.toString()
  // 注意：不带尾斜杠，由 next.config 重写规则映射回后端带斜杠的地址，避免跨域 307 丢 token
  return request<PathRecord[]>(`/admin/paths${qs ? `?${qs}` : ""}`)
}

/** GET /admin/paths/{path_id} — 获取单条路线详情 */
export async function pathsGet(pathId: number) {
  return request<PathRecord>(`/admin/paths/${pathId}`)
}

/** POST /admin/paths/ — 保存路线 */
export async function pathsCreate(data: PathCreatePayload) {
  return request<PathRecord>("/admin/paths", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

/** PUT /admin/paths/{path_id} — 修改路线 */
export async function pathsUpdate(pathId: number, data: PathUpdatePayload) {
  return request<PathRecord>(`/admin/paths/${pathId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

/** DELETE /admin/paths/{path_id} — 删除路线 */
export async function pathsDelete(pathId: number) {
  return request(`/admin/paths/${pathId}`, { method: "DELETE" })
}

/** GET /admin/sites/ — 获取所有站点 */
export async function sitesList() {
  return request<SiteRecord[]>("/admin/sites")
}

/** POST /admin/sites/ — 新增站点 */
export async function sitesCreate(data: SiteCreatePayload) {
  return request<SiteRecord>("/admin/sites", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

/** PUT /admin/sites/{site_id} — 修改站点 */
export async function sitesUpdate(siteId: number, data: SiteUpdatePayload) {
  return request<SiteRecord>(`/admin/sites/${siteId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

/** DELETE /admin/sites/{site_id} — 删除站点 */
export async function sitesDelete(siteId: number) {
  return request(`/admin/sites/${siteId}`, { method: "DELETE" })
}

/** GET /admin/waypoints/ — 获取所有途经点 */
export async function waypointsList() {
  return request<WaypointRecord[]>("/admin/waypoints")
}

/** POST /admin/waypoints/ — 新增途经点 */
export async function waypointsCreate(data: WaypointCreatePayload) {
  return request<WaypointRecord>("/admin/waypoints", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

/** PUT /admin/waypoints/{wp_id} — 修改途经点 */
export async function waypointsUpdate(wpId: number, data: WaypointUpdatePayload) {
  return request<WaypointRecord>(`/admin/waypoints/${wpId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

/** DELETE /admin/waypoints/{wp_id} — 删除途经点 */
export async function waypointsDelete(wpId: number) {
  return request(`/admin/waypoints/${wpId}`, { method: "DELETE" })
}

// ==================== 便捷导出：兼容旧版简写 ====================

export const login = oauthLogin
export const logout = oauthLogout
export const register = oauthRegister
export const sendCode = oauthSendCode
