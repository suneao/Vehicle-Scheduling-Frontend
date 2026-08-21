"use client"

import * as React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  LogInIcon,
  LayoutDashboardIcon,
  CalendarDaysIcon,
  CarFrontIcon,
  BotIcon,
  RouteIcon,
  AlarmClockIcon,
  UsersIcon,
  SettingsIcon,
  VideoIcon,
  CircleHelpIcon,
  CornerDownRightIcon,
} from "lucide-react"

/* ==================== 小部件 ==================== */

function DocSection({
  id,
  icon: Icon,
  title,
  path,
  children,
}: {
  id: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  path: string
  children: React.ReactNode
}) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20">
            <Icon className="size-3.5 text-primary" />
          </span>
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {path}
          </Badge>
        </div>
        <CardDescription>操作说明</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-5">{children}</CardContent>
    </Card>
  )
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
        <CornerDownRightIcon className="size-3 text-primary" />
        {title}
      </h3>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted-foreground/80">{children}</p>
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-xs leading-relaxed text-muted-foreground/80">
          <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] text-primary">
            {i + 1}
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ol>
  )
}

function Tips({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-xs leading-relaxed text-muted-foreground/80">
          <span className="mt-1 size-1 shrink-0 rounded-full bg-muted-foreground/30" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  )
}

/* ==================== 页面数据 ==================== */

const sections = [
  { id: "auth", label: "登录与注册", icon: LogInIcon },
  { id: "dashboard", label: "仪表盘", icon: LayoutDashboardIcon },
  { id: "schedule", label: "调度中心", icon: CalendarDaysIcon },
  { id: "vehicle", label: "车辆调度", icon: CarFrontIcon },
  { id: "patrol", label: "机器狗巡逻", icon: BotIcon },
  { id: "monitor", label: "实时监控", icon: VideoIcon },
  { id: "routes", label: "路线编辑", icon: RouteIcon },
  { id: "events", label: "事件管理", icon: AlarmClockIcon },
  { id: "account", label: "账户管理", icon: UsersIcon },
  { id: "settings", label: "设置", icon: SettingsIcon },
]

export default function HelpPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5">
      {/* 页头 */}
      <div className="flex shrink-0 items-center gap-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
          <CircleHelpIcon className="size-3.5 text-primary" />
        </span>
        <h1 className="text-sm font-medium">帮助中心</h1>
        <span className="text-xs text-muted-foreground/40">按页面分类的操作说明</span>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]" style={{ minHeight: 0 }}>
        {/* 目录 */}
        <aside className="hidden lg:block">
          <nav className="sticky top-4 flex flex-col gap-0.5">
            <p className="mb-2 text-[10px] font-medium tracking-wider text-muted-foreground/40 uppercase">
              目录
            </p>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground/70 transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <s.icon className="size-3.5 shrink-0 text-muted-foreground/40" />
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* 内容 */}
        <div className="flex min-w-0 flex-col gap-5">
          <DocSection id="auth" icon={LogInIcon} title="登录与注册" path="/login · /register">
            <Sub title="登录">
              <Steps
                items={[
                  <>打开 <code className="font-mono text-[11px]">/login</code>，输入用户名和密码后点击“登录”。</>,
                  <>未登录时访问任何页面会自动跳转到登录页。</>,
                  <>演示账号：<Badge variant="secondary" className="font-mono text-[10px]">admin</Badge> / <Badge variant="secondary" className="font-mono text-[10px]">123456</Badge>。</>,
                ]}
              />
            </Sub>
            <Sub title="注册">
              <Steps
                items={[
                  <>填写姓名、昵称、邮箱、密码、地址，点击“发送验证码”将验证码发送到邮箱。</>,
                  <>输入邮箱验证码后提交，即可创建普通账户。</>,
                ]}
              />
            </Sub>
            <Tips
              items={[
                <>管理员与普通账户权限不同：管理员可在账户管理页操作所有账户；普通账户只能编辑自己的信息。</>,
                <>忘记密码请联系管理员。</>,
              ]}
            />
          </DocSection>

          <DocSection id="dashboard" icon={LayoutDashboardIcon} title="仪表盘" path="/">
            <Sub title="实时监控">
              <P>
                顶部统计卡片展示车辆总数与活跃车辆数；左侧全局监控视图展示所有车辆的实时位置、朝向与速度
                （水滴形标记，内部编号为车辆 id）；右侧车辆状态列表按车辆逐条展示坐标与速度。
              </P>
              <Tips
                items={[
                  <>页面每秒自动轮询刷新一次实时数据。</>,
                  <>没有真实车辆接入时，会自动注入虚拟测试车辆用于前端演示。</>,
                ]}
              />
            </Sub>
            <Sub title="系统日志">
              <P>底部日志面板记录车辆数量变更等系统事件，自动保持滚动。</P>
              <Tips
                items={[
                  <>页面最多显示最近 50 条日志；更早的日志请查看服务端 log 文件。</>,
                  <>日志过多时面板内部可继续向下滚动查看更多内容。</>,
                ]}
              />
            </Sub>
          </DocSection>

          <DocSection id="schedule" icon={CalendarDaysIcon} title="调度中心" path="/schedule">
            <P>调度中心是调度功能的入口，包含四张功能卡片，点击任意卡片进入对应页面：</P>
            <Steps
              items={[
                <><strong className="text-foreground/90">车辆调度</strong>：车辆位置监控、执行路线分配、循迹导航与控制命令。</>,
                <><strong className="text-foreground/90">机器狗巡逻调度</strong>：机器狗巡逻路线分配与控制，逻辑与车辆调度一致。</>,
                <><strong className="text-foreground/90">路线编辑</strong>：在地图上绘制、编辑、删除巡逻路线。</>,
                <><strong className="text-foreground/90">事件管理</strong>：配置定时事件（时间 + 路线 + 车辆 + 开关动作 + 优先级）。</>,
              ]}
            />
          </DocSection>

          <DocSection id="vehicle" icon={CarFrontIcon} title="车辆调度" path="/schedule/vehicle">
            <Sub title="选择车辆">
              <Steps
                items={[
                  <>在左侧地图上<strong className="text-foreground/90">单击</strong>任意车辆标记即可选中，右侧面板切换为车辆详情。</>,
                  <>再次单击已选中的车辆可取消选中。</>,
                  <>地图右上角提供视角控制：<strong className="text-foreground/90">跟随</strong>（选中后自动适配视野）、<strong className="text-foreground/90">自由</strong>（手动拖动缩放）、<strong className="text-foreground/90">居中</strong>（重置初始视角）。</>,
                  <>选中后地图会显示该车辆的执行路线（带起/终标注）以及到路线起点的虚线导航路径。</>,
                ]}
              />
            </Sub>
            <Sub title="车辆详情">
              <Steps
                items={[
                  <><strong className="text-foreground/90">实时数据</strong>：坐标、速度、电量、朝向、更新时间，随轮询自动刷新。</>,
                  <><strong className="text-foreground/90">执行路线</strong>：通过下拉框为车辆分配路线，分配后虚拟车辆将沿路线行驶；也可清除路线。</>,
                  <><strong className="text-foreground/90">循迹导航</strong>：分配路线后出现“循迹导航”按钮，点击向车辆发送开始循迹指令。</>,
                  <><strong className="text-foreground/90">控制命令</strong>：启动、暂停、继续、取消任务、休眠。</>,
                ]}
              />
            </Sub>
          </DocSection>

          <DocSection id="patrol" icon={BotIcon} title="机器狗巡逻调度" path="/schedule/patrol">
            <P>机器狗巡逻调度与车辆调度使用相同的交互逻辑，仅文案与图标不同：</P>
            <Steps
              items={[
                <>右侧面板顶部为<strong className="text-foreground/90">巡逻路线卡片</strong>，展示所有已配置的路线，可跳转到路线编辑页管理。</>,
                <>单击地图上的机器狗标记选中，右侧切换为机器狗详情。</>,
                <>在详情中为机器狗分配<strong className="text-foreground/90">巡逻路线</strong>，点击<strong className="text-foreground/90">循迹导航</strong>开始巡逻。</>,
                <>控制命令：启动巡逻、暂停、继续、停止巡逻、休眠。</>,
              ]}
            />
          </DocSection>

          <DocSection id="monitor" icon={VideoIcon} title="实时监控" path="/schedule/monitor">
            <Sub title="两级监控视图">
              <Steps
                items={[
                  <><strong className="text-foreground/90">低分辨率预览</strong>：在车辆/机器狗调度页选中目标后，右侧详情面板显示低分辨率监控缩略图。</>,
                  <><strong className="text-foreground/90">完整监控页</strong>：点击预览图或“进入完整监控”按钮，打开独立的实时监控页面。</>,
                ]}
              />
            </Sub>
            <Sub title="监控切换">
              <P>右侧“监控切换”卡片列出该车辆/机器狗的多路监控（车辆：前视/后视/左视/右视/全景；机器狗：前视/后视/俯视/全景），点击即可切换主画面。</P>
            </Sub>
            <Sub title="画面缩放与移动">
              <Steps
                items={[
                  <>点击右上角<strong className="text-foreground/90">放大 / 缩小 / 重置</strong>按钮调整缩放倍率。</>,
                  <>点击右下角<strong className="text-foreground/90">方向按钮</strong>平移画面，点击<strong className="text-foreground/90">居中</strong>恢复默认视角。</>,
                  <>也可以使用<strong className="text-foreground/90">鼠标滚轮</strong>缩放，<strong className="text-foreground/90">按住鼠标拖动</strong>平移画面。</>,
                ]}
              />
            </Sub>
            <Sub title="无监控状态">
              <P>当车辆/机器狗暂未上报数据（离线）时，画面区域显示“无监控”，此时不显示监控画面。</P>
            </Sub>
            <Tips
              items={[
                <>监控画面为本地模拟流，接入真实摄像头后会自动替换为实时视频。</>,
                <>实时数据卡片展示坐标、速度、电量、朝向与更新时间。</>,
              ]}
            />
          </DocSection>

          <DocSection id="routes" icon={RouteIcon} title="路线编辑" path="/schedule/routes">
            <Sub title="添加路线">
              <Steps
                items={[
                  <>点击“添加路线”进入绘制模式，在地图上点击依次添加航点（至少 2 个），点击“保存路线”完成。</>,
                  <>绘制模式中<strong className="text-foreground/90">拖动</strong>航点可调整位置，<strong className="text-foreground/90">双击</strong>任意航点可删除该点。</>,
                ]}
              />
            </Sub>
            <Sub title="路径生成模式">
              <P>绘制/编辑时可切换三种模式：</P>
              <Tips
                items={[
                  <><strong className="text-foreground/90">吸附道路</strong>：调用高德驾车路径规划 API，路径贴合真实道路，适合车辆行驶。</>,
                  <><strong className="text-foreground/90">贝塞尔曲线</strong>：本地生成穿过所有航点的平滑曲线，适合示意性路径。</>,
                  <><strong className="text-foreground/90">折线</strong>：航点之间直接以直线连接，无贴路、无平滑。</>,
                  <>查看路线信息（非编辑）时只读显示该路线使用的模式，不可修改。</>,
                ]}
              />
            </Sub>
            <Sub title="编辑路线">
              <Steps
                items={[
                  <>点击列表中的铅笔图标（或选中路线后点“编辑路线”）进入编辑。</>,
                  <><strong className="text-foreground/90">拖动</strong>橙色编号点调整航点位置。</>,
                  <><strong className="text-foreground/90">点击线段</strong>在最近处插入新航点；在首尾端点外侧点击可延伸路线。</>,
                  <><strong className="text-foreground/90">双击</strong>航点可删除；也可在右侧点列表中逐点删除。</>,
                  <>点击“保存”生效（至少保留 2 个点），“取消”丢弃改动。</>,
                ]}
              />
            </Sub>
            <Sub title="途径站点">
              <Steps
                items={[
                  <>编辑路线时，点击航点右侧的<strong className="text-foreground/90">站点图标（图钉）</strong>可把该点设为途径站点，地图上以<strong className="text-foreground/90">菱形“停”标记</strong>显示。</>,
                  <>点击站点行可展开行为设置：<strong className="text-foreground/90">到站自动发车</strong>（停车等待设定秒数后自动继续行驶）或<strong className="text-foreground/90">手动发车</strong>（停车等待人工发送“继续”指令发车）。</>,
                  <>虚拟车辆会真实执行停站：自动站点停车等待后自动发车；手动站点一直等待，直到在车辆/机器狗详情中发送“继续”或“循迹导航”指令。</>,
                ]}
              />
            </Sub>
            <Sub title="地图显示">
              <Tips
                items={[
                  <>每条路线以带描边的实线显示，并标注<strong className="text-foreground/90">起点“起”</strong>（实心圆）与<strong className="text-foreground/90">终点“终”</strong>（圆环），箭头指示行进方向。</>,
                  <>点击路线或起/终标记可选中预览；选中的路线加粗并带光晕。</>,
                  <>被事件引用的路线无法删除，需先删除相关事件。</>,
                ]}
              />
            </Sub>
          </DocSection>

          <DocSection id="events" icon={AlarmClockIcon} title="事件管理" path="/schedule/events">
            <Sub title="添加事件">
              <Steps
                items={[
                  <>点击“添加事件”，填写事件名称、执行时间、关联路线、目标车辆、动作（开启/关闭）与优先级。</>,
                  <><strong className="text-foreground/90">优先级</strong>为数字，越大越先执行。</>,
                  <>点击“添加事件”保存。</>,
                ]}
              />
            </Sub>
            <Sub title="管理事件">
              <Tips
                items={[
                  <>事件列表按优先级排序展示，可通过 ↑↓ 按钮调整事件的优先级顺序。</>,
                  <>点击编辑图标修改事件，点击删除图标移除事件（删除后不可恢复）。</>,
                  <>服务器事件 API 尚未提供，事件数据保存在本地浏览器。</>,
                ]}
              />
            </Sub>
          </DocSection>

          <DocSection id="account" icon={UsersIcon} title="账户管理" path="/account">
            <Sub title="权限说明">
              <Tips
                items={[
                  <><strong className="text-foreground/90">管理员</strong>：可查看、编辑、删除所有账户，可授予/取消其他账户的管理员权限，可创建新用户。</>,
                  <><strong className="text-foreground/90">普通账户</strong>：仅可编辑、删除自己的账户。</>,
                  <>列表中的当前账户始终置顶显示。</>,
                ]}
              />
            </Sub>
            <Sub title="常见操作">
              <Steps
                items={[
                  <>点击账户行查看详细信息（角色、邮箱、电话等）。</>,
                  <>管理员点击“创建用户”，填写信息并通过邮箱验证码创建新账户。</>,
                  <>编辑账户可修改姓名、昵称、邮箱、电话、启用状态等字段。</>,
                ]}
              />
            </Sub>
          </DocSection>

          <DocSection id="settings" icon={SettingsIcon} title="设置" path="/settings">
            <Sub title="外观主题">
              <Tips
                items={[
                  <>支持<strong className="text-foreground/90">亮色 / 暗色 / 跟随系统</strong>三种模式，切换后全站生效。</>,
                ]}
              />
            </Sub>
            <Sub title="地图主题">
              <Tips
                items={[
                  <>亮色模式与暗色模式的地图主题可<strong className="text-foreground/90">分别配置</strong>（如亮色马卡龙、暗色幻影黑）。</>,
                  <>部分环境 WebGL 不可用，地图无法切换主题，此时地图固定使用亮色主题配置。</>,
                ]}
              />
            </Sub>
          </DocSection>

          <p className={cn("py-2 text-center text-[10px] text-muted-foreground/30")}>
            车辆调度系统 · 帮助中心
          </p>
        </div>
      </div>
    </div>
  )
}
