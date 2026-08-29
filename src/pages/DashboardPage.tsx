import { Link } from 'react-router-dom'
import { ArrowRight, BookMarked, Database, PenLine, Timer, TrendingUp } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useStore } from '@/lib/store'

export function DashboardPage() {
  const { questions, wrongIds, favoriteIds, records } = useStore()

  const totalAnswers = records.reduce((s, r) => s + r.total, 0)
  const totalCorrect = records.reduce((s, r) => s + r.correct, 0)
  const accuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0
  const categories = [...new Set(questions.map((q) => q.category))]

  const trend = [...records]
    .slice(0, 10)
    .reverse()
    .map((r, i) => ({
      name: `#${i + 1}`,
      正确率: Math.round((r.correct / r.total) * 100),
    }))

  const stats = [
    { label: '题库总量', value: questions.length, icon: Database, hint: `${categories.length} 个分类`, tile: 'bg-sky-100 text-sky-600' },
    { label: '累计答题', value: totalAnswers, icon: PenLine, hint: `${records.length} 次练习/考试`, tile: 'bg-violet-100 text-violet-600' },
    { label: '总正确率', value: `${accuracy}%`, icon: TrendingUp, hint: '全部历史记录', tile: 'bg-emerald-100 text-emerald-600' },
    { label: '待攻克错题', value: wrongIds.length, icon: BookMarked, hint: `收藏 ${favoriteIds.length} 题`, tile: 'bg-amber-100 text-amber-600' },
  ]

  return (
    <div className="space-y-6">
      {/* 欢迎区 */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-sky-500 to-cyan-400 p-6 text-white shadow-lg shadow-sky-200 sm:p-8">
        <div className="deco-pattern pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
          <Timer className="h-3.5 w-3.5" /> 今天也是进步的一天
        </div>
        <h1 className="relative mt-3 text-2xl font-bold sm:text-3xl">开始今天的刷题计划</h1>
        <p className="relative mt-2 max-w-xl text-sm leading-relaxed text-sky-50">
          导入你的题库，按顺序或随机练习；用模拟考试检验水平，错题自动归集，针对性二刷。
        </p>
        <div className="relative mt-5 flex flex-wrap gap-3">
          <Button asChild variant="secondary" className="cursor-pointer font-semibold shadow-md">
            <Link to="/practice">
              开始练习 <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="cursor-pointer border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white">
            <Link to="/exam">模拟考试</Link>
          </Button>
        </div>
      </section>

      {/* 统计卡片 */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, hint, tile }) => (
          <Card key={label} className="transition-all hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="flex items-center gap-3.5 pt-5">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tile}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight tabular-nums">{value}</p>
                <p className="truncate text-xs text-muted-foreground">{label} · {hint}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {/* 正确率趋势 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">近期正确率趋势</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length < 2 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                完成 2 次以上练习或考试后，这里会展示正确率曲线。
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <Tooltip
                    formatter={(v) => [`${v}%`, '正确率']}
                    contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', fontSize: 13 }}
                  />
                  <Line type="monotone" dataKey="正确率" stroke="#0EA5E9" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 分类分布 + 快捷练习 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">分类题量分布</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categories.map((c) => {
              const count = questions.filter((q) => q.category === c).length
              return (
                <Link key={c} to="/practice" className="group block space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium transition-colors group-hover:text-primary">{c}</span>
                    <span className="text-muted-foreground">{count} 题</span>
                  </div>
                  <Progress value={(count / questions.length) * 100} className="h-2" />
                </Link>
              )
            })}
            <p className="pt-1 text-xs text-muted-foreground">点击分类可快速进入练习</p>
          </CardContent>
        </Card>
      </section>

      {/* 最近记录 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">最近练习记录</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              还没有记录，去完成一次练习或模拟考试吧。
            </p>
          ) : (
            <ul className="divide-y">
              {records.slice(0, 6).map((r) => {
                const acc = Math.round((r.correct / r.total) * 100)
                return (
                  <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      <span className={r.mode === 'exam' ? 'font-medium text-amber-500' : 'font-medium text-primary'}>
                        {r.mode === 'exam' ? '模拟考试' : '练习'}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(r.finishedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {r.violations > 0 && <span className="text-xs text-red-500">异常 {r.violations} 次</span>}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{Math.round(r.duration / 60)} 分钟</span>
                      <span className={`font-semibold tabular-nums ${acc >= 60 ? 'text-green-600' : 'text-red-500'}`}>
                        {r.correct}/{r.total}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
