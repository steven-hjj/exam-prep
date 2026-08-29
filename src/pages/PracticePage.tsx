import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, ChevronLeft, ChevronRight, Keyboard, ListOrdered, PenLine, RotateCcw, Shuffle } from 'lucide-react'
import { toast } from 'sonner'
import { AnswerSheet } from '@/components/AnswerSheet'
import { QuestionCard } from '@/components/QuestionCard'
import { ScoreRing } from '@/components/ScoreRing'
import { SideToolPanel } from '@/components/SideToolPanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { useQuizKeys } from '@/hooks/useQuizKeys'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { gradeQuestion, type AnswerMap, type Question, type QuestionType } from '@/types'

type Phase = 'setup' | 'session' | 'summary'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const LETTERS = 'ABCDEFGH'

export function PracticePage() {
  const { banks, questions, favoriteIds, toggleFavorite, setWrong, addRecord } = useStore()
  const [searchParams] = useSearchParams()

  const [phase, setPhase] = useState<Phase>('setup')
  const [bankId, setBankId] = useState(searchParams.get('bank') ?? 'all')
  const [category, setCategory] = useState('all')
  const [mode, setMode] = useState<'answer' | 'recite'>('answer')
  const [order, setOrder] = useState<'sequential' | 'random'>('random')
  const [count, setCount] = useState(10)

  const [session, setSession] = useState<Question[]>([])
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [judged, setJudged] = useState<Set<string>>(new Set())
  const [current, setCurrent] = useState(0)
  const [startTime, setStartTime] = useState(0)

  const bankPool = bankId === 'all' ? questions : questions.filter((q) => q.bankId === bankId)
  const categories = useMemo(() => [...new Set(bankPool.map((q) => q.category))], [bankPool])
  const pool = category === 'all' ? bankPool : bankPool.filter((q) => q.category === category)

  const start = () => {
    const picked = (order === 'random' ? shuffle(pool) : pool).slice(0, Math.min(count, pool.length))
    if (picked.length === 0) {
      toast.error('当前分类下暂无题目')
      return
    }
    setSession(picked)
    setAnswers({})
    setJudged(new Set())
    setCurrent(0)
    setStartTime(Date.now())
    setPhase('session')
  }

  const judgeCurrent = useCallback(() => {
    const q = session[current]
    if (!q || judged.has(q.id)) return
    const ans = answers[q.id]
    if (ans === undefined || ans === '' || (Array.isArray(ans) && ans.every((x) => !x.trim()))) {
      toast.warning('请先作答再提交')
      return
    }
    if (q.type === 'essay') {
      // 解答题：先展示参考答案，由学生自评
      setJudged((prev) => new Set(prev).add(q.id))
      toast.info('已显示参考答案，请对照后自评')
      return
    }
    const ok = gradeQuestion(q, ans)
    setJudged((prev) => new Set(prev).add(q.id))
    setWrong(q.id, !ok)
    if (ok) toast.success('回答正确')
    else toast.error('回答错误，已加入错题本')
  }, [session, current, answers, judged, setWrong])

  const finish = useCallback(() => {
    const correct = session.filter((q) => gradeQuestion(q, answers[q.id])).length
    addRecord({
      id: `r-${Date.now()}`,
      mode: 'practice',
      total: session.length,
      correct,
      duration: Math.round((Date.now() - startTime) / 1000),
      violations: 0,
      finishedAt: Date.now(),
    })
    setPhase('summary')
  }, [session, answers, startTime, addRecord])

  const next = useCallback(() => setCurrent((c) => Math.min(c + 1, session.length - 1)), [session.length])
  const prev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), [])

  const q = session[current]

  /* 键盘快捷键 */
  const handleSelect = useCallback(
    (key: string) => {
      if (!q || judged.has(q.id)) return
      if (q.type === 'multiple') {
        const cur = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : []
        setAnswers((prev) => ({
          ...prev,
          [q.id]: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key],
        }))
      } else {
        setAnswers((prev) => ({ ...prev, [q.id]: key }))
      }
    },
    [q, judged, answers],
  )
  useQuizKeys({
    enabled: phase === 'session' && !!q,
    type: (q?.type ?? 'single') as QuestionType,
    optionCount: q?.options?.length ?? 2,
    onSelect: handleSelect,
    onPrev: prev,
    onNext: next,
    onEnter: mode === 'recite' ? next : q && judged.has(q.id) ? next : judgeCurrent,
  })

  /* ---------- 设置页 ---------- */
  if (phase === 'setup') {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>练习设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>练习题模式</Label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['answer', '答题模式', PenLine, '先作答后看答案，答错自动进错题本'],
                  ['recite', '背题模式', BookOpen, '直接显示答案与解析，快速过题记忆'],
                ] as const).map(([v, label, Icon, desc]) => (
                  <button
                    key={v}
                    onClick={() => setMode(v)}
                    className={cn(
                      'cursor-pointer rounded-xl border p-4 text-left transition-all hover:shadow-sm',
                      mode === v ? 'border-primary bg-accent ring-1 ring-primary/30' : 'bg-card',
                    )}
                  >
                    <Icon className={cn('mb-2 h-5 w-5', mode === v ? 'text-primary' : 'text-muted-foreground')} />
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

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
              <Label>选择分类</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部题目（{questions.length}）</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}（{questions.filter((x) => x.category === c).length}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>出题顺序</Label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['sequential', '顺序刷题', ListOrdered, '按题库顺序逐题推进，适合地毯式过一遍'],
                  ['random', '随机刷题', Shuffle, '随机抽题打乱顺序，模拟真实抽考'],
                ] as const).map(([v, label, Icon, desc]) => (
                  <button
                    key={v}
                    onClick={() => setOrder(v)}
                    className={cn(
                      'cursor-pointer rounded-xl border p-4 text-left transition-all hover:shadow-sm',
                      order === v ? 'border-primary bg-accent ring-1 ring-primary/30' : 'bg-card',
                    )}
                  >
                    <Icon className={cn('mb-2 h-5 w-5', order === v ? 'text-primary' : 'text-muted-foreground')} />
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                题目数量：<span className="font-semibold text-primary">{Math.min(count, pool.length)}</span> / {pool.length}
              </Label>
              <Slider value={[count]} onValueChange={([v]) => setCount(v)} min={5} max={Math.max(pool.length, 5)} step={5} />
            </div>

            <Button className="w-full cursor-pointer" size="lg" onClick={start}>
              开始练习
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Keyboard className="h-3.5 w-3.5" /> 支持快捷键：A/B/C/D 选择 · ←/→ 切换 · Enter 提交
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  /* ---------- 总结页 ---------- */
  if (phase === 'summary') {
    const correct = session.filter((x) => gradeQuestion(x, answers[x.id])).length
    const score = Math.round((correct / session.length) * 100)
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <ScoreRing score={score} label="正确率" />
            <p className="text-sm text-muted-foreground">
              答对 {correct} / {session.length} · 用时 {Math.max(1, Math.round((Date.now() - startTime) / 60000))} 分钟
              {session.length - correct > 0 && ` · ${session.length - correct} 道错题已收入错题本`}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="cursor-pointer" onClick={() => setPhase('setup')}>
                <RotateCcw className="mr-1.5 h-4 w-4" /> 再来一组
              </Button>
              <Button className="cursor-pointer" onClick={() => setPhase('session')}>查看逐题解析</Button>
            </div>
          </CardContent>
        </Card>

        <h2 className="text-lg font-semibold">逐题解析</h2>
        {session.map((x, i) => (
          <QuestionCard
            key={x.id}
            question={x}
            index={i}
            value={answers[x.id]}
            onChange={() => {}}
            showResult
            isFavorite={favoriteIds.includes(x.id)}
            onToggleFavorite={() => toggleFavorite(x.id)}
          />
        ))}
      </div>
    )
  }

  /* ---------- 答题页 ---------- */
  const isRecite = mode === 'recite'
  const judgedArr = session.filter((x) => judged.has(x.id))
  const correctSoFar = judgedArr.filter((x) => gradeQuestion(x, answers[x.id])).length
  const accuracy = judgedArr.length > 0 ? Math.round((correctSoFar / judgedArr.length) * 100) : null
  const isJudged = judged.has(q.id)

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24 lg:pb-6">
      {/* 顶部进度 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {isRecite && <span className="mr-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">背题模式</span>}
            第 <span className="font-semibold text-foreground">{current + 1}</span> / {session.length} 题
          </span>
          {!isRecite && accuracy !== null && (
            <span>
              当前正确率 <span className={cn('font-semibold', accuracy >= 60 ? 'text-green-600' : 'text-red-500')}>{accuracy}%</span>
              <span className="ml-1 text-xs">（{correctSoFar}/{judgedArr.length}）</span>
            </span>
          )}
        </div>
        <Progress value={((current + 1) / session.length) * 100} className="h-1.5" />
      </div>

      <QuestionCard
        question={q}
        index={current}
        value={answers[q.id]}
        onChange={(v) => {
          setAnswers((prev) => ({ ...prev, [q.id]: v }))
          // 解答题自评联动错题本
          if (q.type === 'essay' && (v === 'self:correct' || v === 'self:wrong')) {
            setWrong(q.id, v === 'self:wrong')
            if (v === 'self:wrong') toast.error('已加入错题本')
          }
        }}
        showResult={isRecite || isJudged}
        allowSelfMark
        isFavorite={favoriteIds.includes(q.id)}
        onToggleFavorite={() => toggleFavorite(q.id)}
      />

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" className="cursor-pointer" disabled={current === 0} onClick={prev}>
          <ChevronLeft className="mr-1 h-4 w-4" /> 上一题
        </Button>
        {isRecite ? (
          current === session.length - 1 ? (
            <Button className="cursor-pointer" onClick={() => setPhase('setup')}>结束背题</Button>
          ) : (
            <Button className="cursor-pointer" onClick={next}>
              下一题 <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )
        ) : !isJudged ? (
          <Button className="cursor-pointer" onClick={judgeCurrent}>提交本题</Button>
        ) : current === session.length - 1 ? (
          <Button className="cursor-pointer" onClick={finish}>完成练习</Button>
        ) : (
          <Button className="cursor-pointer" onClick={next}>
            下一题 <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>

      {!isRecite && (
        <p className="text-center text-xs text-muted-foreground/70">
          {LETTERS.slice(0, q.options?.length ?? 0).split('').join(' / ')} 选择 · ←/→ 切换 · Enter {isJudged ? '下一题' : '提交'}
        </p>
      )}

      <SideToolPanel
        mode="practice"
        answerSheet={<AnswerSheet questions={session} answers={answers} current={current} onJump={setCurrent} />}
        onSubmit={isRecite ? () => setPhase('setup') : finish}
        submitLabel={isRecite ? '结束背题' : '结束练习'}
      />
    </div>
  )
}
