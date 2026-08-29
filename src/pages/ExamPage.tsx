import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Keyboard, RotateCcw, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { AnswerSheet } from '@/components/AnswerSheet'
import { QuestionCard } from '@/components/QuestionCard'
import { ScoreRing } from '@/components/ScoreRing'
import { SideToolPanel } from '@/components/SideToolPanel'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAntiCheat } from '@/hooks/useAntiCheat'
import { useQuizKeys } from '@/hooks/useQuizKeys'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { gradeQuestion, isObjective, type AnswerMap, type Question, type QuestionType, type Violation } from '@/types'

type Phase = 'setup' | 'session' | 'result'
const MAX_SERIOUS = 3
/** 强制交卷后的冷却锁定时长（毫秒） */
const LOCKOUT_MS = 10 * 60 * 1000
const SESSION_KEY = 'ep_exam_session'
const LOCKOUTS_KEY = 'ep_exam_lockouts'

/** 中断可恢复的考试会话 */
interface ExamSessionSnapshot {
  sessionId: string
  paper: Question[]
  answers: AnswerMap
  current: number
  startTime: number
  /** 绝对截止时间戳：离开页面计时也不停 */
  deadlineTs: number
  violations: Violation[]
  fullscreen: boolean
}

function getLockouts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LOCKOUTS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function isLocked(sessionId: string) {
  const until = getLockouts()[sessionId]
  return until ? until > Date.now() : false
}

function setLocked(sessionId: string, until: number) {
  const map = getLockouts()
  map[sessionId] = until
  localStorage.setItem(LOCKOUTS_KEY, JSON.stringify(map))
}

function cleanupLockouts() {
  const map = getLockouts()
  const now = Date.now()
  const next: Record<string, number> = {}
  for (const [id, until] of Object.entries(map)) {
    if (until > now) next[id] = until
  }
  localStorage.setItem(LOCKOUTS_KEY, JSON.stringify(next))
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function ExamPage() {
  const { banks, questions, favoriteIds, toggleFavorite, setWrong, addRecord } = useStore()
  const [searchParams] = useSearchParams()

  const [phase, setPhase] = useState<Phase>('setup')
  const [bankId, setBankId] = useState(searchParams.get('bank') ?? 'all')
  const [category, setCategory] = useState('all')
  const [count, setCount] = useState(10)
  const [minutes, setMinutes] = useState(15)
  const [fullscreenMode, setFullscreenMode] = useState(true)

  const [paper, setPaper] = useState<Question[]>([])
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [current, setCurrent] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong'>('all')
  const [resumeData, setResumeData] = useState<ExamSessionSnapshot | null>(null)
  const [resumeLocked, setResumeLocked] = useState(false)
  const startTimeRef = useRef(0)
  const submittedRef = useRef(false)
  const sessionIdRef = useRef('')

  const bankPool = bankId === 'all' ? questions : questions.filter((x) => x.bankId === bankId)
  const categories = useMemo(() => [...new Set(bankPool.map((x) => x.category))], [bankPool])
  const pool = category === 'all' ? bankPool : bankPool.filter((x) => x.category === category)

  /* 挂载时检测未完成的考试 + 清理过期锁定 */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (raw) {
        const s = JSON.parse(raw) as ExamSessionSnapshot
        if (s?.paper?.length) {
          setResumeData(s)
          setResumeLocked(isLocked(s.sessionId))
        }
      }
    } catch {
      /* 存档损坏则忽略 */
    }
    cleanupLockouts()
    const ticker = setInterval(() => {
      cleanupLockouts()
      if (resumeData) setResumeLocked(isLocked(resumeData.sessionId))
    }, 5000)
    return () => clearInterval(ticker)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = useCallback(
    (violations: Violation[], forced = false) => {
      if (submittedRef.current) return
      submittedRef.current = true
      // 解答题不参与自动判分，也不自动进错题本（考后回顾中自查）
      const objective = paper.filter(isObjective)
      const correct = objective.filter((x) => gradeQuestion(x, answers[x.id])).length
      objective.forEach((x) => setWrong(x.id, !gradeQuestion(x, answers[x.id])))
      addRecord({
        id: `r-${Date.now()}`,
        mode: 'exam',
        total: objective.length,
        correct,
        duration: Math.round((Date.now() - startTimeRef.current) / 1000),
        violations: violations.length,
        finishedAt: Date.now(),
      })
      // 交卷后清除会话存档；被强制交卷只锁定当前这一场（sessionId），不影响新开其他考试
      localStorage.removeItem(SESSION_KEY)
      if (forced && sessionIdRef.current) {
        setLocked(sessionIdRef.current, Date.now() + LOCKOUT_MS)
        toast.error('严重违规次数已达上限，本场考试已被强制交卷并锁定，你可以重新开启一场新考试')
      }
      setPhase('result')
      // 延迟退出全屏，等防作弊监听卸载后再退，避免误记一次"退出全屏"
      setTimeout(() => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
      }, 150)
    },
    [paper, answers, setWrong, addRecord],
  )
  const submitRef = useRef(submit)
  submitRef.current = submit
  const violationsRef = useRef<Violation[]>([])

  const { violations, seriousCount, reset, restore } = useAntiCheat({
    enabled: phase === 'session',
    fullscreen: fullscreenMode && phase === 'session',
    maxSeriousViolations: MAX_SERIOUS,
    onViolation: (v, count) => {
      toast.warning(`防作弊警告（${count}/${MAX_SERIOUS}）：${v.label}`, { duration: 4000 })
    },
    onForceSubmit: (vs) => submitRef.current(vs, true),
  })
  violationsRef.current = violations

  /* 考试会话持久化：进度/答案/违规实时存档，中途离开无法"重置"考试 */
  useEffect(() => {
    if (phase !== 'session' || paper.length === 0 || !sessionIdRef.current) return
    const snapshot: ExamSessionSnapshot = {
      sessionId: sessionIdRef.current,
      paper,
      answers,
      current,
      startTime: startTimeRef.current,
      deadlineTs: Date.now() + timeLeft * 1000,
      violations,
      fullscreen: fullscreenMode,
    }
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot))
    } catch {
      /* 存储失败不影响考试 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answers, current, violations])

  /** 恢复未完成的考试：按绝对截止时间重算剩余时间，离开期间计时不停 */
  const resume = () => {
    if (!resumeData) return
    if (isLocked(resumeData.sessionId)) {
      toast.error('该场考试因严重违规已被锁定，无法恢复，请重新开启新考试')
      return
    }
    const remain = Math.max(0, Math.round((resumeData.deadlineTs - Date.now()) / 1000))
    sessionIdRef.current = resumeData.sessionId
    setPaper(resumeData.paper)
    setAnswers(resumeData.answers)
    setCurrent(Math.min(resumeData.current, resumeData.paper.length - 1))
    setTimeLeft(remain)
    startTimeRef.current = resumeData.startTime
    submittedRef.current = false
    reset()
    restore(resumeData.violations ?? [])
    setFullscreenMode(resumeData.fullscreen)
    setPhase('session')
    if (resumeData.fullscreen) {
      document.documentElement.requestFullscreen().catch(() => {})
    }
    if ((resumeData.violations ?? []).length > 0) {
      toast.warning(`已恢复考试，之前的 ${resumeData.violations.length} 次违规记录仍然有效`)
    } else {
      toast.info('已恢复未完成的考试，计时从未停止')
    }
    setResumeData(null)
  }

  /** 放弃未完成的考试（清空存档） */
  const discardResume = () => {
    localStorage.removeItem(SESSION_KEY)
    setResumeData(null)
    setResumeLocked(false)
    toast.info('已清空未完成的考试存档')
  }

  /* 倒计时 */
  useEffect(() => {
    if (phase !== 'session') return
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer)
          toast.warning('考试时间到，已自动交卷')
          submitRef.current(violationsRef.current, false)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const start = () => {
    const picked = shuffle(pool).slice(0, Math.min(count, pool.length))
    if (picked.length === 0) {
      toast.error('当前分类下暂无题目')
      return
    }
    sessionIdRef.current = crypto.randomUUID()
    setPaper(picked)
    setAnswers({})
    setCurrent(0)
    setTimeLeft(minutes * 60)
    startTimeRef.current = Date.now()
    submittedRef.current = false
    reset()
    setPhase('session')
    if (fullscreenMode) {
      document.documentElement.requestFullscreen().catch(() => {
        toast.info('浏览器拒绝了全屏请求，本次以窗口模式考试')
      })
    }
  }

  const q = paper[current]
  const next = useCallback(() => setCurrent((c) => Math.min(c + 1, paper.length - 1)), [paper.length])
  const prev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), [])

  const handleSelect = useCallback(
    (key: string) => {
      if (!q) return
      if (q.type === 'multiple') {
        const cur = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : []
        setAnswers((prevA) => ({
          ...prevA,
          [q.id]: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key],
        }))
      } else {
        setAnswers((prevA) => ({ ...prevA, [q.id]: key }))
      }
    },
    [q, answers],
  )
  useQuizKeys({
    enabled: phase === 'session' && !!q,
    type: (q?.type ?? 'single') as QuestionType,
    optionCount: q?.options?.length ?? 2,
    onSelect: handleSelect,
    onPrev: prev,
    onNext: next,
    onEnter: next,
  })

  /* ---------- 设置页 ---------- */
  if (phase === 'setup') {
    const resumeRemain = resumeData ? Math.max(0, Math.round((resumeData.deadlineTs - Date.now()) / 1000)) : 0
    return (
      <div className="mx-auto max-w-xl space-y-5">
        {/* 未完成考试恢复：若该场已被锁定，只能放弃 */}
        {resumeData && (
          <Card className={`${resumeLocked ? 'border-red-300 bg-red-50/60' : 'border-amber-300 bg-amber-50/60'}`}>
            <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={`text-sm font-semibold ${resumeLocked ? 'text-red-800' : 'text-amber-800'}`}>
                  {resumeLocked ? '该场考试已被锁定' : '检测到未完成的考试'}
                </p>
                <p className={`mt-0.5 text-xs ${resumeLocked ? 'text-red-700' : 'text-amber-700'}`}>
                  {resumeData.paper.length} 题 · 剩余 {Math.floor(resumeRemain / 60)} 分 {resumeRemain % 60} 秒
                  {resumeData.violations.length > 0 && ` · ${resumeData.violations.length} 次违规记录`}
                  {resumeLocked ? ' · 因严重违规被强制交卷，无法恢复，请放弃后重新开考' : ' ，计时从未停止'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="cursor-pointer" onClick={discardResume}>
                  放弃
                </Button>
                {!resumeLocked && (
                  <Button size="sm" className="cursor-pointer" onClick={resume}>
                    继续考试
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>模拟考试设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>选择题库</Label>
              <Select value={bankId} onValueChange={(v) => { setBankId(v); setCategory('all') }}>
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
              <Label>考试范围</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部题目（{bankPool.length}）</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}（{bankPool.filter((x) => x.category === c).length}）
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

            <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
              <div>
                <p className="text-sm font-medium">全屏考试模式</p>
                <p className="text-xs text-muted-foreground">进入考试自动全屏，Esc 退出全屏记为严重违规</p>
              </div>
              <Switch checked={fullscreenMode} onCheckedChange={setFullscreenMode} className="cursor-pointer" />
            </div>

            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>防作弊说明</AlertTitle>
              <AlertDescription className="text-xs leading-relaxed">
                考试期间将：{fullscreenMode && '强制全屏（退出记违规），'}禁用复制/右键/常用快捷键，拦截浏览器返回键，
                检测页面切出与窗口失焦（累计 {MAX_SERIOUS} 次强制交卷并锁定本场，可重新开考新的一场），捕获 PrintScreen 并清空剪贴板。
                中途退出/刷新不会重置考试——进度、计时与违规记录都会保留，回来后继续。
              </AlertDescription>
            </Alert>

            <Button className="w-full cursor-pointer" size="lg" onClick={start}>
              进入考试
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Keyboard className="h-3.5 w-3.5" /> A/B/C/D 选择 · ←/→ 切换 · Enter 下一题
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  /* ---------- 成绩页 ---------- */
  if (phase === 'result') {
    const objective = paper.filter(isObjective)
    const essayCount = paper.length - objective.length
    const correct = objective.filter((x) => gradeQuestion(x, answers[x.id])).length
    const score = objective.length > 0 ? Math.round((correct / objective.length) * 100) : 0
    const reviewList = reviewFilter === 'wrong' ? paper.filter((x) => !gradeQuestion(x, answers[x.id])) : paper
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <ScoreRing score={score} />
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>客观题答对 <b className="text-green-600">{correct}</b> / {objective.length}</span>
              {essayCount > 0 && <span className="text-amber-600">解答题 {essayCount} 道请对照回顾自评</span>}
              <span>用时 {fmt(Math.round((Date.now() - startTimeRef.current) / 1000))}</span>
              <span>剩余 {fmt(timeLeft)}</span>
              {violations.length > 0 && <span className="text-red-500">异常行为 {violations.length} 次</span>}
            </div>
            <Button variant="outline" className="cursor-pointer" onClick={() => setPhase('setup')}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> 再考一次
            </Button>
          </CardContent>
        </Card>

        {violations.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>本次考试记录到 {violations.length} 次异常行为</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 list-inside list-disc text-xs">
                {violations.slice(0, 5).map((v, i) => (
                  <li key={i}>
                    {new Date(v.time).toLocaleTimeString('zh-CN')} — {v.label}
                  </li>
                ))}
                {violations.length > 5 && <li>……</li>}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">逐题回顾</h2>
          <Tabs value={reviewFilter} onValueChange={(v) => setReviewFilter(v as 'all' | 'wrong')}>
            <TabsList>
              <TabsTrigger value="all" className="cursor-pointer">全部（{paper.length}）</TabsTrigger>
              <TabsTrigger value="wrong" className="cursor-pointer">仅错题（{paper.length - correct}）</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {reviewList.map((x) => (
          <QuestionCard
            key={x.id}
            question={x}
            index={paper.indexOf(x)}
            value={answers[x.id]}
            onChange={() => {}}
            showResult
            isFavorite={favoriteIds.includes(x.id)}
            onToggleFavorite={() => toggleFavorite(x.id)}
          />
        ))}
        {reviewList.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">满分！没有错题可回顾。</CardContent>
          </Card>
        )}
      </div>
    )
  }

  /* ---------- 考试页（沉浸式全屏考场：整块覆盖，隐藏应用侧边栏与顶栏） ---------- */
  const progress = ((current + 1) / paper.length) * 100
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* 考场顶栏 */}
      <div className="space-y-2 border-b bg-card/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">考试中</span>
            第 <span className="font-semibold">{current + 1}</span> / {paper.length} 题
          </span>
          <span className={cn('font-mono text-lg font-bold tabular-nums', timeLeft < 300 ? 'animate-pulse text-red-500' : 'text-primary')}>
            {fmt(timeLeft)}
          </span>
          <span className="flex items-center gap-2">
            {seriousCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-red-500">
                <AlertTriangle className="h-3.5 w-3.5" /> 警告 {seriousCount}/{MAX_SERIOUS}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer text-muted-foreground hover:text-red-500"
              onClick={() => setConfirmOpen(true)}
            >
              交卷退出
            </Button>
          </span>
        </div>
        <div className="mx-auto max-w-4xl">
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>

      {/* 题目区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 pb-32 sm:px-6">
          <QuestionCard
            question={q}
            index={current}
            value={answers[q.id]}
            onChange={(v) => setAnswers((prevA) => ({ ...prevA, [q.id]: v }))}
            isFavorite={favoriteIds.includes(q.id)}
            onToggleFavorite={() => toggleFavorite(q.id)}
          />

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" className="cursor-pointer" disabled={current === 0} onClick={prev}>
              上一题
            </Button>
            {current < paper.length - 1 ? (
              <Button className="cursor-pointer" onClick={next}>下一题</Button>
            ) : (
              <Button className="cursor-pointer" onClick={() => setConfirmOpen(true)}>交卷</Button>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground/70">
            A/B/C/D 选择 · ←/→ 切换 · Enter 下一题
          </p>
        </div>
      </div>

      <SideToolPanel
        mode="exam"
        timeLeft={fmt(timeLeft)}
        timeUrgent={timeLeft < 300}
        violationCount={seriousCount}
        answerSheet={<AnswerSheet questions={paper} answers={answers} current={current} onJump={setCurrent} />}
        onSubmit={() => setConfirmOpen(true)}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认交卷？</AlertDialogTitle>
            <AlertDialogDescription>
              已答 {paper.filter((p) => answers[p.id] !== undefined).length} / {paper.length} 题，交卷后不可修改答案。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">继续答题</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer" onClick={() => submit(violations)}>
              确认交卷
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
