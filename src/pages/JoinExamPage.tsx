import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, FileQuestion, GraduationCap, Loader2, ShieldAlert } from 'lucide-react'
import { toast, Toaster } from 'sonner'
import { AnswerSheet } from '@/components/AnswerSheet'
import { QuestionCard } from '@/components/QuestionCard'
import { ScoreRing } from '@/components/ScoreRing'
import { SideToolPanel } from '@/components/SideToolPanel'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { useAntiCheat } from '@/hooks/useAntiCheat'
import { useQuizKeys } from '@/hooks/useQuizKeys'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { gradeQuestion, isObjective, type AnswerMap, type ExamSession, type Question, type QuestionType, type Violation } from '@/types'

type Phase = 'loading' | 'invalid' | 'entry' | 'exam' | 'done'
const MAX_SERIOUS = 3

function fmt(sec: number): string {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

/** 学生端：扫码/链接进入，输昵称即考，成绩与违规实时回传老师 */
export function JoinExamPage() {
  const { code } = useParams<{ code: string }>()
  const [phase, setPhase] = useState<Phase>('loading')
  const [session, setSession] = useState<ExamSession | null>(null)
  const [studentId, setStudentId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const [answers, setAnswers] = useState<AnswerMap>({})
  const [current, setCurrent] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const startTimeRef = useRef(0)
  const submittedRef = useRef(false)

  /* 加载场次 */
  useEffect(() => {
    ;(async () => {
      if (!supabase || !code) {
        setPhase('invalid')
        return
      }
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('code', code.toUpperCase())
        .maybeSingle()
      if (error || !data) {
        setPhase('invalid')
        return
      }
      setSession({
        id: data.id, code: data.code, teacherId: data.teacher_id, title: data.title,
        minutes: data.minutes, fullscreen: data.fullscreen, paper: data.paper as Question[],
        createdAt: new Date(data.created_at).getTime(),
      })
      setPhase('entry')
    })()
  }, [code])

  const submit = useCallback(
    async (violations: Violation[], forced = false) => {
      if (submittedRef.current || !session) return
      submittedRef.current = true
      const correct = session.paper.filter((q) => isObjective(q) && gradeQuestion(q, answers[q.id])).length
      if (supabase) {
        const { error } = await supabase.from('exam_results').insert({
          session_code: session.code,
          teacher_id: session.teacherId,
          student_name: name.trim(),
          student_id: studentId.trim(),
          student_phone: phone.trim(),
          total: session.paper.filter(isObjective).length,
          correct,
          duration: Math.round((Date.now() - startTimeRef.current) / 1000),
          violations,
        })
        if (error) toast.warning('成绩回传失败（不影响本地查看分数）')
      }
      if (forced) toast.error('严重违规次数已达上限，已强制交卷')
      setPhase('done')
      setTimeout(() => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
      }, 150)
    },
    [session, answers, name, studentId, phone],
  )
  const submitRef = useRef(submit)
  submitRef.current = submit
  const violationsRef = useRef<Violation[]>([])

  const { violations, seriousCount } = useAntiCheat({
    enabled: phase === 'exam',
    fullscreen: (session?.fullscreen ?? false) && phase === 'exam',
    maxSeriousViolations: MAX_SERIOUS,
    onViolation: (v, count) => {
      toast.warning(`防作弊警告（${count}/${MAX_SERIOUS}）：${v.label}`, { duration: 4000 })
    },
    onForceSubmit: (vs) => submitRef.current(vs, true),
  })
  violationsRef.current = violations

  /* 倒计时 */
  useEffect(() => {
    if (phase !== 'exam') return
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

  const startExam = () => {
    if (!studentId.trim()) {
      toast.warning('请填写学号（必填，用于老师核对身份）')
      return
    }
    if (!name.trim()) {
      toast.warning('请填写姓名')
      return
    }
    if (phone.trim() && !/^1[3-9]\d{9}$/.test(phone.trim())) {
      toast.warning('手机号格式不正确（选填，可不填）')
      return
    }
    if (!session) return
    startTimeRef.current = Date.now()
    setTimeLeft(session.minutes * 60)
    submittedRef.current = false
    setPhase('exam')
    if (session.fullscreen) {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }

  const q = session?.paper[current]
  const next = useCallback(() => setCurrent((c) => Math.min(c + 1, (session?.paper.length ?? 1) - 1)), [session])
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
    enabled: phase === 'exam' && !!q,
    type: (q?.type ?? 'single') as QuestionType,
    optionCount: q?.options?.length ?? 2,
    onSelect: handleSelect,
    onPrev: prev,
    onNext: next,
    onEnter: next,
  })

  /* ---------- 加载中 ---------- */
  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  /* ---------- 无效链接 ---------- */
  if (phase === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <FileQuestion className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-semibold">考试链接无效</p>
            <p className="text-sm text-muted-foreground">考试码不存在或考试已被删除，请向老师确认。</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  /* ---------- 登记入场 ---------- */
  if (phase === 'entry' && session) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-cyan-300/30 blur-3xl" />
        <Toaster richColors position="top-center" />
        <Card className="relative w-full max-w-sm shadow-xl shadow-sky-100">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 text-white shadow-md shadow-sky-200">
              <GraduationCap className="h-6 w-6" />
            </div>
            <CardTitle>{session.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {session.paper.length} 题 · {session.minutes} 分钟 · 考试码 {session.code}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stu-id">
                学号 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="stu-id"
                placeholder="如：20260101（重名也靠它区分）"
                value={studentId}
                maxLength={20}
                onChange={(e) => setStudentId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stu-name">
                姓名 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="stu-name"
                placeholder="如：李明"
                value={name}
                maxLength={20}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stu-phone">手机号（选填）</Label>
              <Input
                id="stu-phone"
                type="tel"
                placeholder="用于老师联系，可不填"
                value={phone}
                maxLength={11}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startExam()}
              />
            </div>
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>考试纪律</AlertTitle>
              <AlertDescription className="text-xs leading-relaxed">
                {session.fullscreen && '考试将全屏进行，'}切出页面、按返回键、复制、截屏都会被记录并实时回传老师，
                严重违规 {MAX_SERIOUS} 次将强制交卷。
              </AlertDescription>
            </Alert>
            <Button className="w-full cursor-pointer" size="lg" onClick={startExam}>
              进入考试
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  /* ---------- 成绩页 ---------- */
  if (phase === 'done' && session) {
    const objective = session.paper.filter(isObjective)
    const essayCount = session.paper.length - objective.length
    const correct = objective.filter((x) => gradeQuestion(x, answers[x.id])).length
    const score = objective.length > 0 ? Math.round((correct / objective.length) * 100) : 0
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Toaster richColors position="top-center" />
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <ScoreRing score={score} />
            <p className="text-center text-sm text-muted-foreground">
              {name.trim()}，你的成绩已提交给老师
              <br />
              客观题答对 {correct} / {objective.length} · 用时 {fmt(Math.round((Date.now() - startTimeRef.current) / 1000))}
              {essayCount > 0 && <><br />另有 {essayCount} 道解答题，老师会另行批改</>}
            </p>
            {violations.length > 0 && (
              <p className="text-xs text-red-500">本次考试记录到 {violations.length} 次异常行为，已一并回传</p>
            )}
            <p className="text-xs text-muted-foreground">现在可以关闭页面了</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  /* ---------- 考试页（沉浸式） ---------- */
  if (!session || !q) return null
  const progress = ((current + 1) / session.paper.length) * 100
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <Toaster richColors position="top-center" />
      {/* 考场顶栏 */}
      <div className="space-y-2 border-b bg-card/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{session.title}</span>
            第 <span className="font-semibold">{current + 1}</span> / {session.paper.length} 题
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
              onClick={() => submitRef.current(violationsRef.current, false)}
            >
              交卷
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
          />
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" className="cursor-pointer" disabled={current === 0} onClick={prev}>
              上一题
            </Button>
            {current < session.paper.length - 1 ? (
              <Button className="cursor-pointer" onClick={next}>下一题</Button>
            ) : (
              <Button className="cursor-pointer" onClick={() => submitRef.current(violationsRef.current, false)}>交卷</Button>
            )}
          </div>
        </div>
      </div>

      <SideToolPanel
        mode="exam"
        timeLeft={fmt(timeLeft)}
        timeUrgent={timeLeft < 300}
        violationCount={seriousCount}
        answerSheet={<AnswerSheet questions={session.paper} answers={answers} current={current} onJump={setCurrent} />}
        onSubmit={() => submitRef.current(violationsRef.current, false)}
      />
    </div>
  )
}
