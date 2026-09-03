import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { AlertTriangle, Check, Copy, Loader2, QrCode, Send, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/lib/auth'
import { useStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import type { ExamResultRow, ExamSession, Question, Violation } from '@/types'
import { gradeQuestion, isObjective, TYPE_LABEL } from '@/types'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function genCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

/** 违规详情弹窗：按类型分组统计 + 完整时间线（最新在上） */
function ViolationsDialog({ result, open, onOpenChange }: { result: ExamResultRow | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const stats = useMemo(() => {
    if (!result) return { total: 0, byType: [] as { type: Violation['type']; label: string; count: number }[] }
    const map = new Map<string, { type: Violation['type']; label: string; count: number }>()
    for (const v of result.violations) {
      const cur = map.get(v.type)
      if (cur) cur.count++
      else map.set(v.type, { type: v.type, label: v.label, count: 1 })
    }
    return { total: result.violations.length, byType: Array.from(map.values()).sort((a, b) => b.count - a.count) }
  }, [result])

  const timeline = useMemo(() => {
    if (!result) return [] as Violation[]
    return [...result.violations].sort((a, b) => b.time - a.time)
  }, [result])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            异常行为详情
          </DialogTitle>
          {result && (
            <DialogDescription>
              {result.studentName}（{result.studentId || '—'}）· {stats.total} 次记录
            </DialogDescription>
          )}
        </DialogHeader>
        {result && stats.total > 0 ? (
          <div className="space-y-4">
            {/* 按类型统计 */}
            <div className="flex flex-wrap gap-2">
              {stats.byType.map((s) => (
                <Badge key={s.type} variant="destructive" className="px-2 py-0.5 text-xs">
                  {s.label} ×{s.count}
                </Badge>
              ))}
            </div>
            {/* 完整时间线 */}
            <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg border bg-muted/30 p-3">
              {timeline.map((v, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                    <span>{v.label}</span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(v.time).toLocaleTimeString('zh-CN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">该考生无异常行为记录</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** 成绩详情弹窗：显示每题对错、学生答案、正确答案 */
function ResultDetailsDialog({ result, open, onOpenChange }: { result: ExamResultRow | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [session, setSession] = useState<ExamSession | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!result || !supabase) return
    setLoading(true)
    supabase
      .from('exam_sessions')
      .select('*')
      .eq('code', result.sessionCode)
      .single()
      .then(({ data, error }) => {
        setLoading(false)
        if (!error && data) {
          setSession({
            ...data,
            paper: data.paper as Question[],
            createdAt: new Date(data.created_at).getTime(),
          } as ExamSession)
        }
      })
  }, [result])

  if (!result) return null

  const getAnswerText = (q: Question): string => {
    if (q.type === 'single' || q.type === 'judge') return String(q.answer)
    if (q.type === 'multiple') return (q.answer as string[]).sort().join(', ')
    if (q.type === 'fill') return (q.answer as string[]).join('；')
    return String(q.answer)
  }

  const getAnswerKeys = (): string[] => {
    if (!result.answers || Array.isArray(result.answers)) return []
    return Object.keys(result.answers)
  }

  const getUserAnswerWithSource = (
    q: Question,
    index: number,
  ): { value: string | string[] | undefined; source: 'id' | 'index' | 'none' } => {
    const raw = result.answers
    if (!raw) return { value: undefined, source: 'none' }
    if (Array.isArray(raw)) return { value: raw[index] as string | string[] | undefined, source: 'index' }

    const byId = raw[q.id]
    if (byId !== undefined) return { value: byId, source: 'id' }

    const fallbackKeys = [String(index + 1), String(index), `q${index + 1}`, `question_${index + 1}`]
    for (const key of fallbackKeys) {
      if (raw[key] !== undefined) return { value: raw[key], source: 'index' }
    }
    return { value: undefined, source: 'none' }
  }

  const getUserAnswer = (q: Question, index: number): string | string[] | undefined => {
    return getUserAnswerWithSource(q, index).value
  }

  const isNonEmptyAnswer = (value: string | string[] | undefined): boolean => {
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== ''
  }

  const getUserAnswerText = (q: Question, index: number): string => {
    const userAnswer = getUserAnswer(q, index)
    if (!isNonEmptyAnswer(userAnswer)) return '未作答'
    if (Array.isArray(userAnswer)) return userAnswer.join('；')
    return String(userAnswer)
  }

  const answerKeys = getAnswerKeys()

  const matchStats = session
    ? session.paper.reduce(
        (acc, q, i) => {
          const { source } = getUserAnswerWithSource(q, i)
          if (source === 'id') acc.byId += 1
          else if (source === 'index') acc.byIndex += 1
          else acc.unmatched += 1
          return acc
        },
        { byId: 0, byIndex: 0, unmatched: 0 },
      )
    : { byId: 0, byIndex: 0, unmatched: 0 }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{result.studentName} 的答题详情</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !session ? (
          <p className="py-6 text-center text-sm text-muted-foreground">无法加载试卷信息</p>
        ) : (
          <div className="space-y-4 py-2">
            <div className={`rounded-lg border px-3 py-2 text-xs ${answerKeys.length === 0 ? 'border-red-200 bg-red-50 text-red-700' : 'bg-muted/40 text-muted-foreground'}`}>
              <p className="font-medium">已收到答案字段：{answerKeys.length} 个</p>
              {answerKeys.length > 0 && (
                <p className="mt-1">按题目 ID 匹配：{matchStats.byId} 题；按题号兜底：{matchStats.byIndex} 题；未匹配：{matchStats.unmatched} 题。键示例：{answerKeys.slice(0, 6).join(', ')}{answerKeys.length > 6 ? '…' : ''}</p>
              )}
              {answerKeys.length === 0 && (
                <p className="mt-1">说明数据库中该条成绩没有 answers 字段。请确认：① 小程序交卷时结果页显示“已提交 X 题答案”；② Supabase 已执行 `alter table exam_results add column if not exists answers jsonb;`。</p>
              )}
            </div>
            {session.paper.map((q, i) => {
              const userAnswer = getUserAnswer(q, i)
              const isCorrect = isObjective(q) && gradeQuestion(q, userAnswer)
              const isAnswered = isNonEmptyAnswer(userAnswer)

              return (
                <div key={q.id} className={`rounded-lg border p-4 ${isCorrect ? 'border-green-200 bg-green-50' : isAnswered ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">第 {i + 1} 题</span>
                    <Badge variant="secondary" className="text-xs">{TYPE_LABEL[q.type]}</Badge>
                    <span className={`ml-auto text-xs font-medium ${isCorrect ? 'text-green-600' : isAnswered ? 'text-red-600' : 'text-yellow-600'}`}>
                      {isCorrect ? '✓ 正确' : isAnswered ? '✗ 错误' : '未作答'}
                    </span>
                  </div>
                  <div className="mt-2 text-sm">
                    <p className="whitespace-pre-wrap">{q.stem}</p>
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <p><span className="text-muted-foreground">学生答案：</span>{getUserAnswerText(q, i)}</p>
                    <p><span className="text-muted-foreground">正确答案：</span><span className="text-green-600">{getAnswerText(q)}</span></p>
                  </div>
                  {q.analysis && (
                    <div className="mt-3 border-t pt-3 text-sm">
                      <p className="text-muted-foreground">解析：</p>
                      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{q.analysis}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function joinUrl(code: string): string {
  // 小程序路径，微信扫码后可直接进入小程序并带上考试码
  return `pages/index/index?code=${code}`
}

export function TeacherExamPage() {
  const { user, cloudEnabled } = useAuth()
  const { banks, questions } = useStore()
  const navigate = useNavigate()

  const [bankId, setBankId] = useState('all')
  const [title, setTitle] = useState('')
  const [count, setCount] = useState(10)
  const [minutes, setMinutes] = useState(15)
  const [fullscreen, setFullscreen] = useState(true)
  const [expiresHours, setExpiresHours] = useState(24)
  const [creating, setCreating] = useState(false)

  const [sessions, setSessions] = useState<ExamSession[]>([])
  const [qrFor, setQrFor] = useState<ExamSession | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [resultsFor, setResultsFor] = useState<ExamSession | null>(null)
  const [results, setResults] = useState<ExamResultRow[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [violationsFor, setViolationsFor] = useState<ExamResultRow | null>(null)
  const [detailsFor, setDetailsFor] = useState<ExamResultRow | null>(null)

  const pool = bankId === 'all' ? questions : questions.filter((q) => q.bankId === bankId)

  const loadSessions = useCallback(async () => {
    if (!supabase || !user) return
    const { data } = await supabase
      .from('exam_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setSessions(
      (data ?? []).map((s) => ({
        id: s.id, code: s.code, teacherId: s.teacher_id, title: s.title,
        minutes: s.minutes, fullscreen: s.fullscreen, paper: s.paper as Question[],
        createdAt: new Date(s.created_at).getTime(),
        expiresAt: s.expires_at ? new Date(s.expires_at).getTime() : undefined,
      })),
    )
  }, [user])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  useEffect(() => {
    if (!qrFor) return
    QRCode.toDataURL(joinUrl(qrFor.code), { width: 260, margin: 1 }).then(setQrDataUrl)
  }, [qrFor])

  useEffect(() => {
    if (!resultsFor || !supabase) return
    supabase
      .from('exam_results')
      .select('*')
      .eq('session_code', resultsFor.code)
      .order('finished_at', { ascending: false })
      .then(({ data }) => {
        setResults(
          (data ?? []).map((r) => ({
            id: r.id, sessionCode: r.session_code, studentName: r.student_name,
            studentId: r.student_id ?? '', studentPhone: r.student_phone ?? '',
            total: r.total, correct: r.correct, duration: r.duration,
            violations: r.violations ?? [], finishedAt: new Date(r.finished_at).getTime(),
            answers: r.answers ?? {},
          })),
        )
      })
  }, [resultsFor])

  const createSession = async () => {
    if (!supabase || !user) return
    const picked = shuffle(pool).slice(0, Math.min(count, pool.length))
    if (picked.length === 0) {
      toast.error('当前题库下暂无题目')
      return
    }
    setCreating(true)
    const code = genCode()
    const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000)
    const { error } = await supabase.from('exam_sessions').insert({
      code,
      teacher_id: user.id,
      title: title.trim() || '模拟考试',
      minutes,
      fullscreen,
      paper: picked,
      expires_at: expiresAt.toISOString(),
    })
    setCreating(false)
    if (error) {
      toast.error(`创建失败：${error.message}（请确认已执行最新 schema.sql）`)
      return
    }
    toast.success(`考试已创建，考试码 ${code}`)
    setTitle('')
    loadSessions()
    // 直接展示二维码
    setQrFor({
      id: '', code, teacherId: user.id, title: title.trim() || '模拟考试',
      minutes, fullscreen, paper: picked, createdAt: Date.now(), expiresAt: expiresAt.getTime(),
    })
  }

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code)
      setTimeout(() => setCopied(null), 1500)
      toast.success('考试码已复制')
    })
  }

  /* 未登录/未配置云端的引导 */
  if (!cloudEnabled || !user) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="text-lg font-semibold">老师功能需要登录</p>
              <p className="mt-1 text-sm text-muted-foreground">
                登录后即可上传试卷、发起考试，学生扫码免注册参加。
              </p>
            </div>
            <Button className="cursor-pointer" onClick={() => navigate('/login')}>去登录 / 注册</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">发起考试</h1>
        <p className="text-sm text-muted-foreground">组卷生成考试码与二维码，学生扫码免注册参考，成绩实时回传</p>
      </div>

      {/* 组卷区 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">新建考试</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>考试名称</Label>
            <Input placeholder="如：高一数学第三章测验" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>选择题库</Label>
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部题库（{questions.length}）</SelectItem>
                {banks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}（{questions.filter((x) => x.bankId === b.id).length}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>
              题目数量：<span className="font-semibold text-primary">{Math.min(count, pool.length)}</span> / {pool.length}
            </Label>
            <Slider value={[count]} onValueChange={([v]) => setCount(v)} min={5} max={Math.max(pool.length, 5)} step={5} />
          </div>
          <div className="space-y-2">
            <Label>
              考试时长：<span className="font-semibold text-primary">{minutes}</span> 分钟
            </Label>
            <Slider value={[minutes]} onValueChange={([v]) => setMinutes(v)} min={5} max={120} step={5} />
          </div>
          <div className="space-y-2">
            <Label>
              考试码有效期：<span className="font-semibold text-primary">{expiresHours}</span> 小时
            </Label>
            <Slider value={[expiresHours]} onValueChange={([v]) => setExpiresHours(v)} min={1} max={168} step={1} />
            <p className="text-xs text-muted-foreground">超过有效期后，学生输入考试码将无法进入考试</p>
          </div>
          <div className="flex items-center justify-between rounded-xl border px-4 py-3 sm:col-span-2">
            <div>
              <p className="text-sm font-medium">学生端全屏防作弊</p>
              <p className="text-xs text-muted-foreground">学生考试自动全屏，切出/返回/截屏均记录并回传老师</p>
            </div>
            <Switch checked={fullscreen} onCheckedChange={setFullscreen} className="cursor-pointer" />
          </div>
          <Button className="cursor-pointer sm:col-span-2" size="lg" disabled={creating} onClick={createSession}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            生成考试（二维码 + 考试码）
          </Button>
        </CardContent>
      </Card>

      {/* 场次列表 */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">我的考试场次</h2>
        {sessions.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              还没有发起过考试，先在上方创建一场吧。
            </CardContent>
          </Card>
        )}
        {sessions.map((s) => {
          const isExpired = s.expiresAt ? Date.now() > s.expiresAt : false
          return (
            <Card key={s.id} className={`transition-shadow hover:shadow-md ${isExpired ? 'opacity-60' : ''}`}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    {s.title}
                    <Badge variant="secondary" className="font-mono">{s.code}</Badge>
                    {isExpired && <Badge variant="destructive" className="text-xs">已过期</Badge>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.paper.length} 题 · {s.minutes} 分钟 · {new Date(s.createdAt).toLocaleString('zh-CN')}
                  </p>
                  {s.expiresAt && (
                    <p className={`mt-0.5 text-xs ${isExpired ? 'text-red-500' : 'text-muted-foreground'}`}>
                      截止：{new Date(s.expiresAt).toLocaleString('zh-CN')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => copyLink(s.code)}>
                    {copied === s.code ? <Check className="mr-1 h-3.5 w-3.5 text-green-600" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                    复制考试码
                  </Button>
                  <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setQrFor(s)}>
                    <QrCode className="mr-1 h-3.5 w-3.5" /> 二维码
                  </Button>
                  <Button size="sm" className="cursor-pointer" onClick={() => setResultsFor(s)}>
                    成绩（{s.code}）
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 二维码弹窗 */}
      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>学生扫码参考</DialogTitle>
          </DialogHeader>
          {qrFor && (
            <div className="flex flex-col items-center gap-4 py-2">
              {qrDataUrl && <img src={qrDataUrl} alt={`考试码 ${qrFor.code} 二维码`} className="rounded-xl border" />}
              <p className="font-mono text-2xl font-bold tracking-widest text-primary">{qrFor.code}</p>
              <div className="rounded-lg bg-muted p-3 text-center text-xs text-muted-foreground">
                <p className="font-medium text-foreground">学生操作步骤</p>
                <p className="mt-1">1. 微信打开「题练通」小程序</p>
                <p>2. 输入上方考试码</p>
                <p>3. 填写姓名学号后开始考试</p>
              </div>
              <Button variant="outline" className="cursor-pointer" onClick={() => copyLink(qrFor.code)}>
                <Copy className="mr-1.5 h-4 w-4" /> 复制考试码
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 成绩弹窗 */}
      <Dialog open={!!resultsFor} onOpenChange={(o) => !o && setResultsFor(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>「{resultsFor?.title}」成绩（{results.length} 人交卷）</DialogTitle>
          </DialogHeader>
          {results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">还没有学生交卷。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>学号</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>手机号</TableHead>
                  <TableHead>得分</TableHead>
                  <TableHead>用时</TableHead>
                  <TableHead>违规</TableHead>
                  <TableHead>详情</TableHead>
                  <TableHead>交卷时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => {
                  const score = Math.round((r.correct / r.total) * 100)
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono font-medium">{r.studentId || '—'}</TableCell>
                      <TableCell className="font-medium">{r.studentName}</TableCell>
                      <TableCell className="text-muted-foreground">{r.studentPhone || '—'}</TableCell>
                      <TableCell className={score >= 60 ? 'font-semibold text-green-600' : 'font-semibold text-red-500'}>
                        {score}（{r.correct}/{r.total}）
                      </TableCell>
                      <TableCell>{Math.floor(r.duration / 60)}分{r.duration % 60}秒</TableCell>
                      <TableCell>
                        {r.violations.filter((v) => v.type !== 'fast-answer').length > 0 ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 cursor-pointer px-2 text-red-500 hover:bg-red-50 hover:text-red-600"
                            onClick={() => setViolationsFor(r)}
                          >
                            <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                            {r.violations.filter((v) => v.type !== 'fast-answer').length} 次
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">无</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 cursor-pointer px-2"
                          onClick={() => setDetailsFor(r)}
                        >
                          详情
                        </Button>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.finishedAt).toLocaleString('zh-CN')}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* 违规详情弹窗 */}
      <ViolationsDialog
        result={violationsFor}
        open={!!violationsFor}
        onOpenChange={(o) => !o && setViolationsFor(null)}
      />

      {/* 成绩详情弹窗 */}
      <ResultDetailsDialog
        result={detailsFor}
        open={!!detailsFor}
        onOpenChange={(o) => !o && setDetailsFor(null)}
      />
    </div>
  )
}
