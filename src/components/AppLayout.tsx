import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Bell, BookMarked, Cloud, CloudOff, Crown, Database, Gauge, GraduationCap, LayoutDashboard, LogOut, Megaphone, PenLine, Send, Shuffle, Timer, UserRound } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Toaster } from '@/components/ui/sonner'
import { CHANGELOG } from '@/data/changelog'
import { useAuth } from '@/lib/auth'
import { useStore } from '@/lib/store'

const NAV = [
  { to: '/', label: '学习总览', icon: LayoutDashboard },
  { to: '/bank', label: '我的题库', icon: Database },
  { to: '/compose', label: '智能组卷', icon: Shuffle },
  { to: '/practice', label: '刷题练习', icon: PenLine },
  { to: '/exam', label: '模拟考试', icon: Timer },
  { to: '/conduct', label: '发起考试', icon: Send },
  { to: '/wrongbook', label: '错题与收藏', icon: BookMarked },
]

function QuotaDialog() {
  const { user } = useAuth()
  const { subscription, quota } = useStore()
  const plan = subscription?.plan ?? 'free'
  const items = [
    { label: '题库数量', used: quota.banksUsed, limit: quota.banksLimit },
    { label: '题目总数', used: quota.questionsUsed, limit: quota.questionsLimit },
    { label: '本月考试', used: quota.examsUsed, limit: quota.examsLimit },
    { label: '本月学生人次', used: quota.studentsUsed, limit: quota.studentsLimit },
    { label: '本月 AI 识别页数', used: quota.aiPagesUsed, limit: quota.aiPagesLimit },
  ]
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="hidden cursor-pointer items-center gap-1.5 text-xs text-amber-600 sm:flex">
          <Crown className="h-3.5 w-3.5" />
          {plan === 'free' ? '免费版' : plan === 'teacher' ? '教师版' : '学校版'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" /> 用量与套餐
          </DialogTitle>
          <DialogDescription>
            当前为 <span className="font-medium text-foreground">{plan === 'free' ? '免费版' : plan === 'teacher' ? '教师版' : '学校版'}</span>，{user?.email ?? ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {items.map((item) => {
            const percent = item.limit > 0 ? Math.min(100, Math.round((item.used / item.limit) * 100)) : 0
            const unlimited = item.limit >= 9999
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {item.used} / {unlimited ? '不限' : item.limit}
                  </span>
                </div>
                {!unlimited && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-amber-500' : 'bg-primary'}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            付费升级入口即将开放，当前仅展示用量上限。
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function AppLayout() {
  const { cloudEnabled, user, signOut } = useAuth()
  const navigate = useNavigate()
  const displayName = (user?.user_metadata?.display_name as string | undefined) || user?.email || ''

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 text-white shadow-md shadow-sky-200">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="bg-gradient-to-r from-sky-600 to-cyan-500 bg-clip-text text-sm font-bold leading-tight text-transparent">题练通</p>
              <p className="text-xs text-muted-foreground">ExamPrep 在线刷题平台</p>
            </div>
          </div>
        </SidebarHeader>
        <Separator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>功能导航</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map(({ to, label, icon: Icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) =>
                          isActive
                            ? 'rounded-lg bg-gradient-to-r from-sky-500 to-cyan-500 font-semibold text-white shadow-md shadow-sky-200 hover:text-white'
                            : 'rounded-lg'
                        }
                      >
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="cursor-pointer" />
          <Separator orientation="vertical" className="h-5" />
          <p className="hidden text-sm text-muted-foreground sm:block">题库 / 练习 / 考试 / 错题闭环</p>
          <div className="ml-auto flex items-center gap-2">
            {/* 更新公告 */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative cursor-pointer" aria-label="更新公告">
                  <Bell className="h-4.5 w-4.5" />
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-96 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-primary" /> 更新公告
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  {CHANGELOG.map((entry) => (
                    <div key={entry.version} className="relative border-l-2 border-border pl-5">
                      <span className={`absolute -left-[5px] top-1.5 h-2 w-2 rounded-full ${entry.isLatest ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                      <div className="flex items-center gap-2">
                        <Badge variant={entry.isLatest ? 'default' : 'secondary'}>{entry.version}</Badge>
                        <span className="text-xs text-muted-foreground">{entry.date}</span>
                        {entry.isLatest && <Badge variant="outline" className="border-red-300 text-red-500">NEW</Badge>}
                      </div>
                      <p className="mt-1.5 text-sm font-semibold">{entry.title}</p>
                      <ul className="mt-1.5 list-inside list-disc space-y-1 text-xs leading-relaxed text-muted-foreground">
                        {entry.items.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>

            {cloudEnabled ? (
              user ? (
                <>
                  <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                    <Cloud className="h-3.5 w-3.5 text-green-600" /> 云端同步中
                  </span>
                  <QuotaDialog />
                  <span className="flex max-w-40 items-center gap-1.5 truncate text-sm">
                    <UserRound className="h-4 w-4 text-primary" />
                    <span className="truncate font-medium">{displayName}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="cursor-pointer text-muted-foreground hover:text-red-500"
                    onClick={() => signOut()}
                    aria-label="退出登录"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button size="sm" className="cursor-pointer" onClick={() => navigate('/login')}>
                  <UserRound className="mr-1.5 h-4 w-4" /> 登录 / 注册
                </Button>
              )
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CloudOff className="h-3.5 w-3.5" /> 本地模式 · 数据保存在本机
              </span>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </SidebarInset>
      <Toaster richColors position="top-center" />
    </SidebarProvider>
  )
}
