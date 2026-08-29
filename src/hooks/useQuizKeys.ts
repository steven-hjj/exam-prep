import { useEffect } from 'react'
import type { QuestionType } from '@/types'

interface QuizKeysOptions {
  enabled: boolean
  type: QuestionType
  optionCount: number
  /** 选择/切换某个选项（single/judge 直接选中，multiple 切换） */
  onSelect: (key: string) => void
  onPrev: () => void
  onNext: () => void
  /** 回车：练习模式=提交/下一题，考试模式=下一题 */
  onEnter: () => void
}

const LETTERS = 'ABCDEFGH'

/**
 * 答题页键盘快捷键：
 * - A~H：选择对应选项（判断题也可用 T/F）
 * - ← / →：上一题 / 下一题
 * - Enter：提交或下一题
 * 焦点位于输入框时不响应（避免填空题冲突）。
 */
export function useQuizKeys({ enabled, type, optionCount, onSelect, onPrev, onNext, onEnter }: QuizKeysOptions) {
  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const key = e.key.toUpperCase()
      if (type === 'judge' && (key === 'T' || key === 'F')) {
        onSelect(key === 'T' ? 'true' : 'false')
        return
      }
      if ((type === 'single' || type === 'multiple') && LETTERS.slice(0, optionCount).includes(key)) {
        onSelect(key)
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        onNext()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onEnter()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, type, optionCount, onSelect, onPrev, onNext, onEnter])
}
