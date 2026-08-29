import { cn } from '@/lib/utils'

interface ScoreRingProps {
  /** 0-100 */
  score: number
  size?: number
  label?: string
}

/** SVG 成绩环形图：及格绿 / 不及格红，带入场动画 */
export function ScoreRing({ score, size = 140, label }: ScoreRingProps) {
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pass = score >= 60

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className={cn('transition-all duration-1000 ease-out', pass ? 'stroke-green-500' : 'stroke-red-400')}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-4xl font-bold tabular-nums', pass ? 'text-green-600' : 'text-red-500')}>{score}</span>
        <span className="text-xs text-muted-foreground">{label ?? '分'}</span>
      </div>
    </div>
  )
}
