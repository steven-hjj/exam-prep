import { cn } from '@/lib/utils'
import type { Question } from '@/types'

interface AnswerSheetProps {
  questions: Question[]
  answers: Record<string, string | string[] | undefined>
  current: number
  onJump: (index: number) => void
}

function answered(v: string | string[] | undefined): boolean {
  if (v === undefined) return false
  if (Array.isArray(v)) return v.some((x) => x.trim() !== '')
  return v.trim() !== ''
}

/** 答题卡：数字宫格，已答高亮，当前题加描边，点击跳转 */
export function AnswerSheet({ questions, answers, current, onJump }: AnswerSheetProps) {
  const done = questions.filter((q) => answered(answers[q.id])).length
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>答题卡</span>
        <span>
          已答 <span className="font-semibold text-primary">{done}</span> / {questions.length}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => onJump(i)}
            className={cn(
              'flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border text-sm transition-colors',
              answered(answers[q.id])
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card hover:bg-accent',
              i === current && 'ring-2 ring-amber-400 ring-offset-1',
            )}
            aria-label={`第 ${i + 1} 题${answered(answers[q.id]) ? '（已答）' : '（未答）'}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-primary" /> 已答
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border bg-card" /> 未答
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border ring-2 ring-amber-400" /> 当前
        </span>
      </div>
    </div>
  )
}
