import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Eye, EyeOff, Loader2, Send, Shuffle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { MathText } from '@/components/MathText'
import { useAuth } from '@/lib/auth'
import { useStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { SUBJECTS, TYPE_LABEL, type Question, type QuestionType } from '@/types'

const ALL_TYPES: QuestionType[] = ['single', 'multiple', 'judge', 'fill', 'essay']

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

export function ComposeExamPage() {
  const { user, cloudEnabled } = useAuth()
  const { banks, questions } = useStore()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('all')
  const [grade, setGrade] = useState('')
  const [category, setCategory] = useState('all')
  const [tagsInput, setTagsInput] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([...ALL_TYPES])
  const [difficultyRange, setDifficultyRange] = useState<[number, number]>([1, 5])
  const [count, setCount] = useState(10)
  const [minutes, setMinutes] = useState(30)
  const [fullscreen, setFullscreen] = useState(true)
  const [composing, setComposing] = useState(false)
  const [composed, setComposed] = useState<Question[] | null>(null)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const allCategories = useMemo(
    () => [...new Set(questions.map((q) => q.category).filter(Boolean))].sort(),
    [questions],
  )
  const allTags = useMemo(
    () => [...new Set(questions.flatMap((q) => q.tags ?? []))].sort(),
    [questions],
  )

  const matchedPool = useMemo(() => {
    const tagSet = tagsInput
      .split(/[\s,，、]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    return questions.filter((q) => {
      if (subject !== 'all' && q.category !== subject) return false
      if (category !== 'all' && q.category !== category) return false
      if (grade && !banks.find((b) => b.id === q.bankId)?.grade?.includes(grade)) return false
      if (selectedTypes.length > 0 && !selectedTypes.includes(q.type)) return false
      const diff = q.difficulty ?? 3
      if (diff < difficultyRange[0] || diff > difficultyRange[1]) return false
      if (tagSet.length > 0 && !tagSet.some((t) => q.tags?.some((qt) => qt.includes(t)))) return false
      return true
    })
  }, [questions, banks, subject, category, grade, selectedTypes, difficultyRange, tagsInput])

  const toggleType = (t: QuestionType) => {
    setSelectedTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  const compose = () => {
    if (matchedPool.length === 0) {
      toast.error('没有符合筛选条件的题目')
      return
    }
    const picked = shuffle(matchedPool).slice(0, Math.min(count, matchedPool.length))
    setComposed(picked)
    toast.success(`已抽取 ${picked.length} 道题`)
  }

  const createSession = async () => {
    if (!supabase || !user || !composed || composed.length === 0) return
    setComposing(true)
    const code = genCode()
    const { error } = await supabase.from('exam_sessions').insert({
      code,
      teacher_id: user.id,
      title: title.trim() || '智能组卷考试',
      minutes,
      fullscreen,
      paper: composed,
    })
    setComposing(false)
    if (error) {
      toast.error(`创建失败：${error.message}`)
      return
    }
    toast.success(`考试已创建，考试码 ${code}`)
    navigate('/conduct')
  }

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (!cloudEnabled || !user) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Shuffle className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="text-lg font-semibold">智能组卷需要登录</p>
              <p className="mt-1 text-sm text-muted-foreground">登录后即可按学科、知识点、难度从题库抽题生成考试。</p>
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
        <h1 className="text-xl font-bold">智能组卷</h1>
        <p className="text-sm text-muted-foreground">按学科、知识点、题型、难度从题库抽题，没有现成试卷也能快速生成考试</p>
      </div>

      {/* 筛选条件 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">组卷条件</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label>考试名称</Label>
            <Input placeholder="如：高一数学函数专项测验" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>学科</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部学科</SelectItem>
                {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>学段/年级（可选）</Label>
            <Input placeholder="如：高三 / IGCSE" value={grade} onChange={(e) => setGrade(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>分类</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label>知识点标签（空格分隔，可选）</Label>
            <div className="flex flex-wrap gap-2">
              {allTags.slice(0, 12).map((t) => (
                <Badge
                  key={t}
                  variant={tagsInput.includes(t) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => {
                    const parts = tagsInput.split(/[\s,，、]+/).map((s) => s.trim()).filter(Boolean)
                    if (parts.includes(t)) {
                      setTagsInput(parts.filter((p) => p !== t).join(' '))
                    } else {
                      setTagsInput([...parts, t].join(' '))
                    }
                  }}
                >
                  {t}
                </Badge>
              ))}
            </div>
            <Input placeholder="输入知识点标签，如：三角函数 易错" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label>题型</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_TYPES.map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={selectedTypes.includes(t) ? 'default' : 'outline'}
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => toggleType(t)}
                >
                  {selectedTypes.includes(t) && <Check className="mr-1 h-3 w-3" />}
                  {TYPE_LABEL[t]}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>
              难度范围：{difficultyRange[0]} ~ {difficultyRange[1]}
            </Label>
            <Slider
              value={difficultyRange}
              onValueChange={(v) => setDifficultyRange(v as [number, number])}
              min={1}
              max={5}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <Label>
              题目数量：{Math.min(count, matchedPool.length)} / 匹配 {matchedPool.length} 道
            </Label>
            <Slider
              value={[count]}
              onValueChange={([v]) => setCount(v)}
              min={1}
              max={Math.max(matchedPool.length, 1)}
              step={1}
              disabled={matchedPool.length === 0}
            />
          </div>
          <div className="space-y-2">
            <Label>考试时长：{minutes} 分钟</Label>
            <Slider value={[minutes]} onValueChange={([v]) => setMinutes(v)} min={5} max={120} step={5} />
          </div>
          <div className="flex items-center justify-between rounded-xl border px-4 py-3 sm:col-span-2 lg:col-span-3">
            <div>
              <p className="text-sm font-medium">学生端全屏防作弊</p>
              <p className="text-xs text-muted-foreground">学生考试自动全屏，切出/返回/截屏均记录并回传老师</p>
            </div>
            <Switch checked={fullscreen} onCheckedChange={setFullscreen} className="cursor-pointer" />
          </div>
          <Button
            className="cursor-pointer sm:col-span-2 lg:col-span-3"
            size="lg"
            disabled={matchedPool.length === 0}
            onClick={compose}
          >
            <Shuffle className="mr-2 h-4 w-4" /> 生成试卷预览
          </Button>
        </CardContent>
      </Card>

      {/* 试卷预览 */}
      {composed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>试卷预览（{composed.length} 题）</span>
              <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setComposed(null)}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> 清空
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {composed.map((q, i) => {
              const isRevealed = revealed.has(q.id)
              return (
                <div key={q.id} className="rounded-lg border bg-muted/20 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>第 {i + 1} 题</span>
                    <Badge variant="secondary">{TYPE_LABEL[q.type]}</Badge>
                    <Badge variant="outline">{q.category}</Badge>
                    {q.tags?.map((t) => <Badge key={t} variant="outline" className="text-muted-foreground">#{t}</Badge>)}
                    <span>难度 {q.difficulty ?? 3}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-6 w-6 cursor-pointer text-muted-foreground"
                      onClick={() => toggleReveal(q.id)}
                    >
                      {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-sm leading-relaxed"><MathText text={q.stem} /></p>
                  {q.options && (
                    <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      {q.options.map((o, j) => (
                        <span key={j}><span className="font-semibold">{'ABCDEFGH'[j]}.</span> <MathText text={o} /></span>
                      ))}
                    </div>
                  )}
                  {isRevealed && (
                    <p className="mt-2 text-xs">
                      答案：<span className="font-semibold text-green-700">
                        {Array.isArray(q.answer) ? q.answer.join(q.type === 'fill' ? ' | ' : '、') : String(q.answer)}
                      </span>
                    </p>
                  )}
                </div>
              )
            })}
            <Button
              className="w-full cursor-pointer"
              size="lg"
              disabled={composing || composed.length === 0}
              onClick={createSession}
            >
              {composing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              用这套题发起考试
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
