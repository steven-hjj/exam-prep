import { Bookmark, CheckCircle2, Lightbulb, XCircle } from 'lucide-react'
import { MathText } from '@/components/MathText'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { gradeQuestion, TYPE_LABEL, type Question } from '@/types'

const LETTERS = 'ABCDEFGH'

interface QuestionCardProps {
  question: Question
  index: number
  value: string | string[] | undefined
  onChange: (v: string | string[]) => void
  /** 是否显示判分结果与解析（练习模式即时反馈 / 考后回顾） */
  showResult?: boolean
  /** 解答题是否允许自我判分（练习/错题本开启；考试回顾关闭） */
  allowSelfMark?: boolean
  isFavorite?: boolean
  onToggleFavorite?: () => void
}

function LetterBadge({ letter, active, tone }: { letter: string; active?: boolean; tone?: 'correct' | 'wrong' }) {
  return (
    <span
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold transition-colors',
        tone === 'correct' && 'border-green-500 bg-green-500 text-white',
        tone === 'wrong' && 'border-red-400 bg-red-400 text-white',
        !tone && (active ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'),
      )}
    >
      {letter}
    </span>
  )
}

/** 单题渲染组件：按题型分发，支持答题与回顾两种状态；题干/选项/解析支持 LaTeX（$...$） */
export function QuestionCard({ question: q, index, value, onChange, showResult, allowSelfMark, isFavorite, onToggleFavorite }: QuestionCardProps) {
  const correct = showResult ? gradeQuestion(q, value) : undefined
  const pickedList = Array.isArray(value) ? value : value ? [value] : []
  const expected = Array.isArray(q.answer) ? q.answer.map(String) : [String(q.answer)]

  /** 选项在结果态下的着色：命中答案=绿，错选=红 */
  const optionTone = (letter: string): 'correct' | 'wrong' | undefined => {
    if (!showResult) return undefined
    if (expected.includes(letter)) return 'correct'
    if (pickedList.includes(letter)) return 'wrong'
    return undefined
  }

  const optionClass = (letter: string) => {
    const tone = optionTone(letter)
    return cn(
      'group flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-all duration-150',
      !showResult && 'hover:border-primary/50 hover:bg-accent hover:shadow-sm active:scale-[0.995]',
      !showResult && pickedList.includes(letter) && 'border-primary bg-accent shadow-sm',
      tone === 'correct' && 'border-green-500 bg-green-50',
      tone === 'wrong' && 'border-red-400 bg-red-50',
      showResult && 'cursor-default',
    )
  }

  const renderOptions = (items: { key: string; letter: string; label: string }[]) => (
    <div className="grid gap-2">
      {items.map(({ key, letter, label }) => (
        <button
          key={key}
          type="button"
          disabled={showResult}
          onClick={() => {
            if (q.type === 'multiple') {
              onChange(pickedList.includes(key) ? pickedList.filter((x) => x !== key) : [...pickedList, key])
            } else {
              onChange(key)
            }
          }}
          className={optionClass(key)}
        >
          <LetterBadge letter={letter} active={pickedList.includes(key)} tone={optionTone(key)} />
          <MathText text={label} className="text-sm leading-relaxed" />
          {q.type === 'multiple' && pickedList.includes(key) && !showResult && (
            <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-primary" />
          )}
        </button>
      ))}
    </div>
  )

  const selfMarked = typeof value === 'string' && (value === 'self:correct' || value === 'self:wrong')

  return (
    <Card
      className={cn(
        'overflow-hidden transition-colors',
        showResult && (correct ? 'border-green-500/50' : 'border-red-400/50'),
      )}
    >
      {/* 结果态顶部色条 */}
      {showResult && <div className={cn('h-1', correct ? 'bg-green-500' : 'bg-red-400')} />}

      <CardHeader className="!flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{TYPE_LABEL[q.type]}</Badge>
          <Badge variant="outline">{q.category}</Badge>
          {q.tags.map((t) => (
            <Badge key={t} variant="outline" className="text-muted-foreground">
              #{t}
            </Badge>
          ))}
        </div>
        {onToggleFavorite && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 cursor-pointer"
            onClick={onToggleFavorite}
            aria-label={isFavorite ? '取消收藏' : '收藏本题'}
          >
            <Bookmark className={cn('h-5 w-5 transition-colors', isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-base font-medium leading-relaxed">
          <span className="mr-2 font-mono text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
          <MathText text={q.stem} />
        </p>

        {q.type === 'single' &&
          renderOptions((q.options ?? []).map((opt, i) => ({ key: LETTERS[i], letter: LETTERS[i], label: opt })))}

        {q.type === 'multiple' && (
          <>
            {renderOptions((q.options ?? []).map((opt, i) => ({ key: LETTERS[i], letter: LETTERS[i], label: opt })))}
            <p className="text-xs text-muted-foreground">多选题：点击选项进行多选</p>
          </>
        )}

        {q.type === 'judge' &&
          renderOptions([
            { key: 'true', letter: '对', label: '正确' },
            { key: 'false', letter: '错', label: '错误' },
          ])}

        {q.type === 'fill' && (
          <div className="grid gap-2 sm:grid-cols-2">
            {(Array.isArray(q.answer) ? q.answer : [q.answer]).map((_, i) => (
              <Input
                key={i}
                placeholder={`第 ${i + 1} 空答案`}
                disabled={showResult}
                value={Array.isArray(value) ? value[i] ?? '' : i === 0 && typeof value === 'string' ? value : ''}
                onChange={(e) => {
                  const cur = Array.isArray(value) ? [...value] : []
                  cur[i] = e.target.value
                  onChange(cur)
                }}
                className={cn(
                  showResult &&
                    (correct ? 'border-green-500 bg-green-50' : 'border-red-400 bg-red-50'),
                )}
              />
            ))}
          </div>
        )}

        {/* 解答题：文本作答 */}
        {q.type === 'essay' && (
          <div className="space-y-2">
            <Textarea
              placeholder="在此写出你的解答过程……（提交后对照参考答案自评）"
              className="min-h-32 resize-y"
              disabled={showResult}
              value={typeof value === 'string' && !value.startsWith('self:') ? value : ''}
              onChange={(e) => onChange(e.target.value)}
            />
            {showResult && typeof value === 'string' && value && !value.startsWith('self:') && (
              <details className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium">我的作答</summary>
                <p className="mt-1 whitespace-pre-wrap">{value}</p>
              </details>
            )}
          </div>
        )}

        {/* 判分结果与解析 */}
        {showResult && q.type !== 'essay' && (
          <div
            className={cn(
              'animate-in fade-in slide-in-from-top-1 rounded-xl border p-4 text-sm duration-200',
              correct ? 'border-green-200 bg-green-50/80' : 'border-red-200 bg-red-50/80',
            )}
          >
            <div className="mb-1.5 flex items-center gap-2 font-semibold">
              {correct ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" /> 回答正确
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-500" /> 回答错误
                </>
              )}
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                正确答案：
                <span className="font-bold text-green-700">
                  {q.type === 'judge'
                    ? q.answer === 'true'
                      ? '正确'
                      : '错误'
                    : Array.isArray(q.answer)
                      ? q.answer.join(q.type === 'fill' ? ' | ' : '、')
                      : q.answer}
                </span>
              </span>
            </div>
            {q.analysis && (
              <p className="flex gap-1.5 leading-relaxed text-muted-foreground">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <MathText text={q.analysis} />
              </p>
            )}
          </div>
        )}

        {/* 解答题：参考答案 + 自评 */}
        {showResult && q.type === 'essay' && (
          <div className="animate-in fade-in slide-in-from-top-1 space-y-3 rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-sm duration-200">
            <div>
              <p className="mb-1 flex items-center gap-2 font-semibold text-sky-800">
                <Lightbulb className="h-4 w-4 text-amber-500" /> 参考答案
              </p>
              <MathText text={String(q.answer)} className="leading-relaxed" />
              {q.analysis && (
                <p className="mt-1 text-muted-foreground">
                  解析：<MathText text={q.analysis} />
                </p>
              )}
            </div>
            {allowSelfMark && !selfMarked && (
              <div className="flex items-center gap-2 border-t border-sky-200 pt-3">
                <span className="text-xs text-muted-foreground">对照后自评：</span>
                <Button size="sm" variant="outline" className="cursor-pointer border-green-300 text-green-700 hover:bg-green-50" onClick={() => onChange('self:correct')}>
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> 我答对了
                </Button>
                <Button size="sm" variant="outline" className="cursor-pointer border-red-300 text-red-600 hover:bg-red-50" onClick={() => onChange('self:wrong')}>
                  <XCircle className="mr-1 h-3.5 w-3.5" /> 我答错了
                </Button>
              </div>
            )}
            {selfMarked && (
              <p className={cn('border-t border-sky-200 pt-3 text-xs font-semibold', correct ? 'text-green-600' : 'text-red-500')}>
                {correct ? '✓ 已自评：答对' : '✗ 已自评：答错（已进错题本）'}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
