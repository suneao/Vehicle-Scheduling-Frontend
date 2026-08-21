# 车辆调度前端（Vehicle Scheduling Frontend）

基于 **Next.js 16** 的车辆与机器狗调度管理前端，集成高德地图（AMap JS API 2.0），提供车辆/机器狗实时监控、路线编辑与循迹调度、事件管理等能力。

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 框架 | Next.js 16.2.6（Turbopack）、React 19、TypeScript |
| 样式 | Tailwind CSS v4、shadcn/ui（@base-ui/react） |
| 地图 | 高德地图 JS API 2.0（`@amap/amap-jsapi-loader`） |
| 状态/数据 | React Hooks、本地缓存；业务数据存取后端 FastAPI |
| 通知 | sonner（Toast） |

## 功能特性

- **仪表盘**：车辆/机器狗实时状态总览（速度、电量、在线数、运行日志）。
- **车辆调度**：实时位置/电量/朝向监控，分配执行路线，循迹导航（导航到起点或从当前位置开始），控制指令（启动/暂停/继续/停止）。
- **机器狗巡逻调度**：与车辆调度逻辑一致，独立列表与路线分配，常驻显示巡逻路径。
- **路线编辑**：在地图上绘制/编辑路线，支持「吸附道路（高德驾车规划）/ 贝塞尔曲线 / 折线」三种模式；航点支持拖拽调整、点击增点、双击删除；可设置途径站点（到站自动/手动发车）。
- **事件管理**：为车辆/机器狗配置定时事件（时间 + 路线 + 开关动作 + 优先级），按优先级执行。
- **实时监控**：车辆/机器狗监控画面（低分辨率预览 + 独立监控页面，支持缩放/拖动）。
- **账户管理**：用户列表、编辑、删除。
- **登录/注册**：JWT 鉴权，演示账号 `admin / 123456`。

## 数据存储说明

- **登录 token**：保存在浏览器 `localStorage`。
- **路线/站点/途经点/地图**：保存在云端（后端 `/admin/maps`、`/admin/paths`、`/admin/sites`、`/admin/waypoints`）。
- **事件**：当前保存在浏览器 `localStorage`（后端暂无事件接口，待接入）。
- **路线分配**（车辆/机器狗 → 路线）：当前保存在浏览器 `localStorage`。

> 说明：贴路后的完整路径、站点「自动/手动」模式、路线颜色等为前端显示信息，后端不保存，刷新后会退化为航点连线，重新编辑即可恢复。

---

## 本地开发

### 环境要求

- Node.js **20+**（推荐 20 LTS 或 22 LTS）
- npm

### 1. 安装依赖

```bash
npm ci
```

### 2. 配置环境变量

创建 `.env.local`（参考 `.env.example`）：

```bash
# 高德地图 Web 端 key（必填，否则地图无法加载）
NEXT_PUBLIC_AMAP_KEY=你的高德Key
NEXT_PUBLIC_AMAP_SECURITY_CODE=你的高德安全密钥

# 后端地址（可选，默认 http://39.108.77.178:8001）
BACKEND_URL=http://39.108.77.178:8001
```

> `.env.local` 已被 `.gitignore` 排除，请勿提交到仓库。

### 3. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000 ，使用 `admin / 123456` 登录。

### 4. 常用命令

```bash
npm run dev        # 开发模式（Turbopack 热更新）
npm run build      # 生产构建
npm run start      # 生产模式运行（需先 build）
npm run typecheck  # TypeScript 类型检查（tsc --noEmit）
npm run lint       # ESLint
```

---

## 部署

### 后端地址配置

前端所有后端请求（`/api/*`、`/admin/*`、`/report/*`）由 **Next.js 服务器端代理**到后端，浏览器不会直连后端，因此**无跨域问题**。后端地址通过 `BACKEND_URL` 环境变量配置（默认 `http://39.108.77.178:8001`）。

### 方案一：PM2 直接运行（推荐）

```bash
# 1. 安装 Node.js 20+（以 Ubuntu/Debian 为例）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# 2. 获取代码
git clone <你的仓库地址> vehicle-scheduling
cd vehicle-scheduling

# 3. 配置环境变量
cat > .env.local <<'EOF'
NEXT_PUBLIC_AMAP_KEY=你的高德Key
NEXT_PUBLIC_AMAP_SECURITY_CODE=你的高德安全密钥
BACKEND_URL=http://39.108.77.178:8001
EOF

# 4. 安装依赖并构建
npm ci
npm run build

# 5. PM2 守护运行（默认端口 3000，可用 npm run start -- -p 8080 改端口）
npm i -g pm2
pm2 start npm --name vehicle-scheduling -- start
pm2 save
pm2 startup   # 按提示执行输出的命令，实现开机自启
```

### 方案二：systemd

```ini
# /etc/systemd/system/vehicle-scheduling.service
[Unit]
Description=Vehicle Scheduling Frontend
After=network.target

[Service]
WorkingDirectory=/path/to/vehicle-scheduling
ExecStart=/usr/bin/npm run start
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vehicle-scheduling
```

### nginx 反向代理（域名 / HTTPS）

```nginx
server {
  listen 80;
  server_name 你的域名;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

HTTPS 可用 certbot 申请证书。nginx 只需把请求转发给前端端口即可，后端代理由 Next.js 内部完成。

### 防火墙与网络

- 开放 3000 端口（或仅开放 nginx 的 80/443）。
- 服务器必须能访问后端地址（默认 `39.108.77.178:8001`）。
- 浏览器需能访问高德 `webapi.amap.com`。

---

## 常见问题

### 1. `npm run build` 因 Google Fonts 失败

`app/layout.tsx` 使用 `next/font/google`（Inter / Geist Mono），**构建时需要联网访问 `fonts.googleapis.com`**。国内服务器访问不了 Google 时构建会失败。解决办法（按推荐顺序）：

1. **在能访问 Google 的机器上构建**，把项目（含 `.next`、`node_modules`、`.env.local`）整体拷贝到服务器运行；
2. **自托管字体**：下载 woff2 文件放入项目，改用 `next/font/local`；
3. **改用系统字体**：去掉 `next/font/google`，使用系统字体栈。

### 2. 登录后进入调度页被踢回登录页

历史问题（已修复）：后端 `admin` 系列列表接口（`/admin/paths/` 等）带尾斜杠，前端经 Next.js 代理时会先 308 去尾斜杠、后端再 307 补尾斜杠，浏览器跟随**跨域重定向时会丢弃 `Authorization` 头**导致 401 循环。现已在 `next.config.ts` 中精确映射，后端直接返回 200，无重定向。若仍出现，请检查浏览器 `localStorage` 中是否有过期 token（清除后重新登录）。

### 3. 地图空白 / 主题不生效

- 检查 `NEXT_PUBLIC_AMAP_KEY` 是否配置且属于「Web 端（JS API）」类型。
- WebGL 不可用时地图会自动降级为亮色渲染（暗色主题仅地图区域保持亮色，为预期行为）。

---

## 目录结构（简）

```
app/                 # 页面（App Router）
  page.tsx           # 仪表盘
  login/ register/   # 登录 / 注册
  schedule/          # 调度中心（车辆/机器狗/路线/事件/监控）
  account/ help/ settings/
components/          # 组件（地图、监控、UI 等）
lib/                 # 业务库（api 封装、路线、事件、地图等）
next.config.ts       # 代理配置（/api /admin /report → 后端）
```

## License

私有项目。
