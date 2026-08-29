import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BookCopy, CheckSquare, CircleDot, Copy, Download, Eye, EyeOff, FileUp, FileText, Loader2, PenLine, Play, Plus, RefreshCw, Search, Sparkles, Timer, ToggleLeft, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { MathText } from '@/components/MathText'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { exportQuestionsJSON, extractWordText, parseExcelFile, parseImportText, renderPdfPages, type ParseResult } from '@/lib/parser'
import { aiExtractQuestionsFromImages, aiExtractQuestionsFromText } from '@/lib/ai'
import { useAuth } from '@/lib/auth'
import { useStore } from '@/lib/store'
import { SUBJECTS, TYPE_LABEL, genBankCode, type Bank, type QuestionType } from '@/types'

const FORMAT_HINT = `【单选】中国的首都是哪里？[分类:地理] [#基础]
A. 上海
B. 北京
C. 广州
答案：B
解析：北京是中华人民共和国首都。

【判断】地球是平的。[分类:地理]
答案：错

【多选】下列哪些是水果？[分类:常识]
A. 苹果
B. 土豆
C. 香蕉
答案：AC

【填空】水的化学式是____。[分类:化学]
答案：H2O

【单选】$\\frac{2}{3}+\\frac{1}{6}$ 的值为？[分类:数学] [#分数运算]
A. $\\frac{1}{2}$
B. $\\frac{5}{6}$
C. 1
答案：B

【大题】求函数 $f(x)=x^2-4x+3$ 的最小值。[分类:数学]
答案：配方得 $f(x)=(x-2)^2-1$，最小值为 $-1$。`

const TYPE_ICON: Record<QuestionType, typeof CircleDot> = {
  single: CircleDot,
  multiple: CheckSquare,
  judge: ToggleLeft,
  fill: PenLine,
  essay: FileText,
}

function answerText(q: { type: QuestionType; answer: string | string[] }): string {
  if (q.type === 'judge') return q.answer === 'true' ? '正确' : '错误'
  return Array.isArray(q.answer) ? q.answer.join(q.type === 'fill' ? ' | ' : '、') : String(q.answer)
}

/** 导入对话框：粘贴文本 / 上传 txt·json·docx·xlsx·pdf（AI 识别在服务端完成，无需任何配置） */
function ImportDialog({ bank, onDone }: { bank: Bank; onDone: () => void }) {
  const { addQuestions } = useStore()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [reviewQuestions, setReviewQuestions] = useState<ParseResult['questions']>([])
  const [reviewSource, setReviewSource] = useState('')
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; pages: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const finish = (result: ParseResult, source = '网页上传') => {
    result.errors.slice(0, 5).forEach((e) => toast.warning(e))
    if (result.errors.length > 5) toast.warning(`……共 ${result.errors.length} 条识别问题`)
    if (result.questions.length > 0) {
      setReviewQuestions(result.questions)
      setReviewSource(source)
      toast.success(`已识别 ${result.questions.length} 道题，请审核后发布到题库`)
    } else if (result.errors.length === 0) toast.error('未解析到任何题目')
  }

  const approveReview = () => {
    addQuestions(reviewQuestions.filter((q) => q.stem.trim() && q.answer !== ''))
    toast.success(`已发布 ${reviewQuestions.length} 道题到「${bank.name}」`)
    setReviewQuestions([])
    setReviewSource('')
    setText('')
    setOpen(false)
    onDone()
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setParsing(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        finish(await parseExcelFile(await file.arrayBuffer(), bank.id))
      } else if (ext === 'pdf') {
        // 一律渲染为图片后由服务端 AI 分批识别：每批 2 页，避免请求过大/超时/输出截断
        setAiBusy(true)
        try {
          const pages = await renderPdfPages(await file.arrayBuffer())
          const batchSize = 2
          const batches = Math.ceil(pages.length / batchSize)
          const allQuestions: ParseResult['questions'] = []
          const allErrors: string[] = []
          for (let i = 0; i < pages.length; i += batchSize) {
            const batchNo = Math.floor(i / batchSize) + 1
            setBatchProgress({ current: batchNo, total: batches, pages: pages.length })
            const startPage = i + 1
            const endPage = Math.min(i + batchSize, pages.length)
            const context = `本次为试卷第 ${startPage}-${endPage} 页（共 ${pages.length} 页中的第 ${batchNo}/${batches} 批）`
            const sourceHint = `${file.name} 第 ${startPage}-${endPage} 页`
            const result = await aiExtractQuestionsFromImages(pages.slice(i, i + batchSize), bank.id, context, sourceHint)
            if (result.questions.length === 0 && result.errors.length === 0) {
              toast.warning(`第 ${batchNo}/${batches} 批（第 ${startPage}-${endPage} 页）未识别到任何题目`)
            }
            result.errors.forEach((e) => toast.warning(`第 ${batchNo} 批错误：${e}`))
            allQuestions.push(...result.questions)
            allErrors.push(...result.errors)
          }
          setBatchProgress(null)
          finish({ questions: allQuestions, errors: allErrors }, `PDF：${file.name}（${pages.length} 页，分 ${batches} 批识别）`)
        } catch {
          setBatchProgress(null)
          toast.error('识别中断，请重试')
        } finally {
          setAiBusy(false)
        }
      } else if (ext === 'docx') {
        const raw = await extractWordText(await file.arrayBuffer())
        setText(raw)
        toast.success('已提取 Word 文字到输入框，可直接导入，或用 AI 智能提取整理格式')
      } else {
        finish(parseImportText(await file.text(), bank.id))
      }
    } catch {
      toast.error('文件解析失败，请检查文件格式')
    } finally {
      setParsing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const runAi = async () => {
    if (!text.trim()) {
      toast.warning('请先粘贴试卷文字或上传 Word 提取文字')
      return
    }
    setAiBusy(true)
    toast.info('正在云端整理题目，通常需要 10~40 秒……')
    try {
      finish(await aiExtractQuestionsFromText(text, bank.id, '文本粘贴'))
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="cursor-pointer">
          <Upload className="mr-1.5 h-4 w-4" /> 上传题目
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{reviewQuestions.length ? '审核识别结果' : `上传题目到「${bank.name}」`}</DialogTitle>
          <DialogDescription>
            {reviewQuestions.length ? `来源：${reviewSource}。确认无误后发布，空答案题目不会进入正式题库。` : '支持 PDF、Word、Excel、TXT、JSON。扫描 PDF 会在网页内渲染并识别，不需要把文件交给智能体。'}
          </DialogDescription>
        </DialogHeader>
        {!user && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠️ 当前未登录：题目只保存在本浏览器。更换网址、清缓存或换设备都会丢失，建议先登录再上传。
          </div>
        )}
        {batchProgress && (
          <div className="space-y-2 rounded-xl border bg-muted/30 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                正在云端识别第 <span className="font-semibold text-primary">{batchProgress.current}</span> / {batchProgress.total} 批
              </span>
              <span className="text-xs text-muted-foreground">共 {batchProgress.pages} 页 · 每批约 20~60 秒</span>
            </div>
            <Progress value={Math.round(((batchProgress.current - 1) / batchProgress.total) * 100)} className="h-2" />
            <p className="text-xs text-muted-foreground">识别期间请勿关闭此窗口，完成后自动进入审核界面</p>
          </div>
        )}
        {reviewQuestions.length > 0 ? (
          <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
            {reviewQuestions.map((q, index) => (
              <div key={q.id} className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>第 {index + 1} 题 · {TYPE_LABEL[q.type]}</span>
                  {!q.answer && <Badge variant="destructive">需补答案</Badge>}
                </div>
                <Textarea className="min-h-16 text-sm" value={q.stem} onChange={(e) => setReviewQuestions((items) => items.map((item) => item.id === q.id ? { ...item, stem: e.target.value } : item))} />
                {q.options?.map((option, optionIndex) => <Input key={optionIndex} className="mt-2 text-sm" value={option} onChange={(e) => setReviewQuestions((items) => items.map((item) => item.id === q.id ? { ...item, options: item.options?.map((value, i) => i === optionIndex ? e.target.value : value) } : item))} placeholder={`选项 ${String.fromCharCode(65 + optionIndex)}`} />)}
                <Input className="mt-2 text-sm" value={Array.isArray(q.answer) ? q.answer.join(',') : String(q.answer)} onChange={(e) => setReviewQuestions((items) => items.map((item) => item.id === q.id ? { ...item, answer: item.type === 'multiple' ? e.target.value.split(/[,，、\s]+/).filter(Boolean) : item.type === 'fill' ? e.target.value.split('|') : e.target.value } : item))} placeholder="答案" />
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Select value={q.category || '未分类'} onValueChange={(v) => setReviewQuestions((items) => items.map((item) => item.id === q.id ? { ...item, category: v } : item))}>
                    <SelectTrigger className="h-8 text-xs cursor-pointer">
                      <SelectValue placeholder="学科分类" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={String(q.difficulty ?? 3)} onValueChange={(v) => setReviewQuestions((items) => items.map((item) => item.id === q.id ? { ...item, difficulty: parseInt(v, 10) } : item))}>
                    <SelectTrigger className="h-8 text-xs cursor-pointer">
                      <SelectValue placeholder="难度" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((d) => <SelectItem key={d} value={String(d)}>难度 {d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input className="h-8 text-xs" placeholder="知识点标签，用空格分隔" value={q.tags?.join(' ') ?? ''} onChange={(e) => setReviewQuestions((items) => items.map((item) => item.id === q.id ? { ...item, tags: e.target.value.split(/[\s,，]+/).filter(Boolean) } : item))} />
                  <Input className="h-8 text-xs" placeholder="来源/出处" value={q.source ?? ''} onChange={(e) => setReviewQuestions((items) => items.map((item) => item.id === q.id ? { ...item, source: e.target.value } : item))} />
                </div>
                {q.analysis && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    解析：<MathText text={q.analysis} />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : <Textarea
          className="h-52 resize-none font-mono text-xs"
          placeholder={FORMAT_HINT}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />}
        {reviewQuestions.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" className="cursor-pointer" onClick={() => setReviewQuestions([])}>返回修改</Button>
            <Button className="cursor-pointer" onClick={approveReview}><CheckSquare className="mr-1.5 h-4 w-4" />审核通过并发布</Button>
          </div>
        ) : <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" className="cursor-pointer" disabled={parsing || aiBusy} onClick={() => fileRef.current?.click()}>
            <FileUp className="mr-1.5 h-4 w-4" /> {parsing || aiBusy ? '识别中…' : '选择文件'}
          </Button>
          <input ref={fileRef} type="file" accept=".txt,.json,.csv,.xlsx,.xls,.docx,.pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <div className="flex gap-2">
            <Button variant="outline" className="cursor-pointer" disabled={aiBusy} onClick={runAi}>
              {aiBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4 text-amber-500" />}
              {aiBusy ? 'AI 提取中…' : 'AI 智能提取'}
            </Button>
            <Button className="cursor-pointer" onClick={() => finish(parseImportText(text, bank.id))}>识别并审核</Button>
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  )
}

export function BankManagePage() {
  const { banks, createBank, deleteBank, questions, removeQuestion } = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newSubject, setNewSubject] = useState<string>('数学')
  const [newGrade, setNewGrade] = useState('')
  const [newCode, setNewCode] = useState('')
  const [pendingCode, setPendingCode] = useState(genBankCode)
  const [deleteTarget, setDeleteTarget] = useState<Bank | null>(null)

  // 列表页搜索与科目筛选
  const [listKeyword, setListKeyword] = useState('')
  const [listSubject, setListSubject] = useState('all')

  // 详情视图状态
  const [category, setCategory] = useState('all')
  const [type, setType] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const selected = banks.find((b) => b.id === selectedId) ?? null

  const bankCount = useMemo(() => {
    const m = new Map<string, number>()
    questions.forEach((q) => m.set(q.bankId, (m.get(q.bankId) ?? 0) + 1))
    return m
  }, [questions])

  const filteredBanks = useMemo(() => {
    const kw = listKeyword.trim().toLowerCase()
    return banks.filter(
      (b) =>
        (listSubject === 'all' || (b.subject || '未分类') === listSubject) &&
        (!kw || b.name.toLowerCase().includes(kw) || (b.code || '').toLowerCase().includes(kw)),
    )
  }, [banks, listKeyword, listSubject])

  /* ================= 题库列表视图 ================= */
  if (!selected) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">我的题库</h1>
            <p className="text-sm text-muted-foreground">
              共 {banks.length} 套题库 · {questions.length} 道题；支持 Word / Excel / TXT 批量上传
            </p>
          </div>
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button className="cursor-pointer">
                <Plus className="mr-1.5 h-4 w-4" /> 新建题库
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新建题库</DialogTitle>
                <DialogDescription>为不同科目/考试创建独立题库，系统自动分配编码便于快速查找。</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>题库名称</Label>
                  <Input placeholder="如：高中数学必修一" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>科目</Label>
                    <Select value={newSubject} onValueChange={setNewSubject}>
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBJECTS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>学段/年级（可选）</Label>
                    <Input placeholder="如：高三 / AP / IGCSE" value={newGrade} onChange={(e) => setNewGrade(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>题库编码（留空自动生成）</Label>
                  <div className="flex gap-2">
                    <Input placeholder={pendingCode} value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} className="font-mono" />
                    <Button variant="outline" size="icon" className="shrink-0 cursor-pointer" aria-label="换一个" onClick={() => setPendingCode(genBankCode())}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>简介（可选）</Label>
                  <Textarea placeholder="题库的适用范围、来源等" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                </div>
                <Button
                  className="w-full cursor-pointer"
                  onClick={() => {
                    if (!newName.trim()) {
                      toast.warning('请填写题库名称')
                      return
                    }
                    const bank = createBank(newName.trim(), newSubject, newGrade.trim(), newDesc.trim(), newCode.trim() || pendingCode)
                    setNewName('')
                    setNewDesc('')
                    setNewGrade('')
                    setNewCode('')
                    setPendingCode(genBankCode())
                    setNewOpen(false)
                    toast.success(`题库已创建，编码 ${bank.code}`)
                  }}
                >
                  创建
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* 搜索 + 科目筛选 */}
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="搜索题库名称或编码（如 BK-7F3K）……" value={listKeyword} onChange={(e) => setListKeyword(e.target.value)} />
          </div>
          <Select value={listSubject} onValueChange={setListSubject}>
            <SelectTrigger className="w-36 cursor-pointer">
              <SelectValue placeholder="全部科目" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部科目</SelectItem>
              {SUBJECTS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="self-center text-sm text-muted-foreground">
            {listSubject === 'all' ? '全部' : listSubject}：{filteredBanks.length} 套
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBanks.map((b) => {
            const count = bankCount.get(b.id) ?? 0
            return (
              <Card key={b.id} className="group flex flex-col transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                        <BookCopy className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{b.name}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <button
                            className="cursor-pointer rounded bg-muted px-1.5 py-0.5 font-mono transition-colors hover:bg-accent hover:text-primary"
                            title="点击复制编码"
                            onClick={() => {
                              navigator.clipboard.writeText(b.code || '').then(() => toast.success(`编码 ${b.code} 已复制`))
                            }}
                          >
                            {b.code || '—'} <Copy className="inline h-3 w-3" />
                          </button>
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{b.subject || '未分类'}</Badge>
                          {b.grade && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{b.grade}</Badge>}
                          <span>{count} 道题</span>
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 cursor-pointer text-muted-foreground opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                      onClick={() => setDeleteTarget(b)}
                      aria-label="删除题库"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-3">
                  <p className="line-clamp-2 min-h-5 text-xs text-muted-foreground">{b.description || '暂无简介'}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setSelectedId(b.id)}>
                      <FileText className="mr-1 h-3.5 w-3.5" /> 管理
                    </Button>
                    <ImportDialog bank={b} onDone={() => {}} />
                    <Button asChild size="sm" variant="ghost" className="cursor-pointer text-primary">
                      <Link to={`/practice?bank=${b.id}`}>
                        <Play className="mr-1 h-3.5 w-3.5" /> 练习
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost" className="cursor-pointer text-amber-600">
                      <Link to={`/exam?bank=${b.id}`}>
                        <Timer className="mr-1 h-3.5 w-3.5" /> 考试
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* 删除确认 */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除题库「{deleteTarget?.name}」？</AlertDialogTitle>
              <AlertDialogDescription>
                库内 {bankCount.get(deleteTarget?.id ?? '') ?? 0} 道题目将一并删除，此操作不可恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
              <AlertDialogAction
                className="cursor-pointer bg-red-500 hover:bg-red-600"
                onClick={() => {
                  if (deleteTarget) {
                    deleteBank(deleteTarget.id)
                    toast.success('题库已删除')
                  }
                  setDeleteTarget(null)
                }}
              >
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  /* ================= 题库详情视图 ================= */
  const bankQs = questions.filter((q) => q.bankId === selected.id)
  const categories = [...new Set(bankQs.map((q) => q.category))]
  const typeCounts = new Map<QuestionType, number>()
  bankQs.forEach((q) => typeCounts.set(q.type, (typeCounts.get(q.type) ?? 0) + 1))
  const filtered = bankQs.filter(
    (q) =>
      (category === 'all' || q.category === category) &&
      (type === 'all' || q.type === type) &&
      (!keyword || q.stem.includes(keyword) || q.tags.some((t) => t.includes(keyword))),
  )
  const toggleReveal = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const doExport = () => {
    const blob = new Blob([exportQuestionsJSON(bankQs)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selected.name}-题库备份.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => setSelectedId(null)} aria-label="返回题库列表">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{selected.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <button
                className="cursor-pointer rounded bg-muted px-1.5 py-0.5 font-mono text-xs transition-colors hover:bg-accent hover:text-primary"
                title="点击复制编码"
                onClick={() => {
                  navigator.clipboard.writeText(selected.code || '').then(() => toast.success(`编码 ${selected.code} 已复制`))
                }}
              >
                {selected.code || '—'} <Copy className="inline h-3 w-3" />
              </button>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{selected.subject || '未分类'}</Badge>
              {selected.grade && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{selected.grade}</Badge>}
              <span>{bankQs.length} 题 · 答案默认隐藏，点眼睛图标查看</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="cursor-pointer" onClick={doExport}>
            <Download className="mr-1.5 h-4 w-4" /> 导出备份
          </Button>
          <ImportDialog bank={selected} onDone={() => {}} />
        </div>
      </div>

      {/* 题型统计 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => {
          const Icon = TYPE_ICON[t]
          return (
            <button
              key={t}
              onClick={() => setType(type === t ? 'all' : t)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-all hover:shadow-sm ${type === t ? 'border-primary ring-1 ring-primary/30' : ''}`}
            >
              <Icon className="h-5 w-5 text-primary" />
              <div>
                <p className="text-lg font-bold leading-tight tabular-nums">{typeCounts.get(t) ?? 0}</p>
                <p className="text-xs text-muted-foreground">{TYPE_LABEL[t]}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* 搜索 + 筛选 */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="搜索题干或标签……" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40 cursor-pointer">
            <SelectValue placeholder="全部分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="self-center text-sm text-muted-foreground">共 {filtered.length} 题</p>
      </div>

      {/* 题目列表 */}
      <div className="space-y-3">
        {filtered.map((q, i) => {
          const isRevealed = revealed.has(q.id)
          return (
            <Card key={q.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="!flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">#{String(i + 1).padStart(3, '0')}</span>
                  <Badge variant="secondary">{TYPE_LABEL[q.type]}</Badge>
                  <Badge variant="outline">{q.category}</Badge>
                  {q.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-muted-foreground">#{t}</Badge>
                  ))}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="cursor-pointer text-muted-foreground hover:text-primary"
                    onClick={() => toggleReveal(q.id)}
                    aria-label={isRevealed ? '隐藏答案' : '显示答案'}
                  >
                    {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="cursor-pointer text-muted-foreground hover:text-red-500"
                    onClick={() => {
                      removeQuestion(q.id)
                      toast.success('已删除该题')
                    }}
                    aria-label="删除题目"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed"><MathText text={q.stem} /></p>
                {q.options && (
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    {q.options.map((o, j) => (
                      <span key={j}><span className="font-semibold">{'ABCDEFGH'[j]}.</span> <MathText text={o} /></span>
                    ))}
                  </div>
                )}
                {isRevealed ? (
                  <p className="mt-2 animate-in fade-in text-xs duration-150">
                    答案：<span className="font-semibold text-green-700">{answerText(q)}</span>
                    {q.analysis && <span className="ml-2 text-muted-foreground">解析：<MathText text={q.analysis} /></span>}
                  </p>
                ) : (
                  <button
                    onClick={() => toggleReveal(q.id)}
                    className="mt-2 cursor-pointer text-xs text-muted-foreground/70 transition-colors hover:text-primary"
                  >
                    ●●● 点击显示答案
                  </button>
                )}
              </CardContent>
            </Card>
          )
        })}
        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {bankQs.length === 0 ? '这套题库还没有题目，点击右上角「上传题目」开始录入。' : '没有符合条件的题目。'}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
