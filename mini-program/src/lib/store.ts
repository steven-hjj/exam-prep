import Taro from '@tarojs/taro'
import type { ExamResultRow, ExamSession, AnswerMap } from '@/types'

const RESULTS_KEY = 'exam_results_local'
const REVIEW_KEY = 'exam_review_data'

export interface ReviewData {
  session: ExamSession
  answers: AnswerMap
  correct: number
  duration: number
  violations: number
  finishedAt: number
}

export function saveReviewData(data: ReviewData): void {
  Taro.setStorageSync(REVIEW_KEY, data)
}

export function getReviewData(): ReviewData | null {
  try {
    return Taro.getStorageSync(REVIEW_KEY) || null
  } catch {
    return null
  }
}

export function clearReviewData(): void {
  Taro.removeStorageSync(REVIEW_KEY)
}

export function saveLocalResult(result: Omit<ExamResultRow, 'id'>): void {
  const list = getLocalResults()
  list.unshift({ ...result, id: `local_${Date.now()}` })
  Taro.setStorageSync(RESULTS_KEY, list.slice(0, 50))
}

export function getLocalResults(): Array<ExamResultRow & { id: string }> {
  try {
    return Taro.getStorageSync(RESULTS_KEY) || []
  } catch {
    return []
  }
}

export function getStudentInfo(): { name: string; studentId: string; phone: string } {
  try {
    return (
      Taro.getStorageSync('student_info') || {
        name: '',
        studentId: '',
        phone: '',
      }
    )
  } catch {
    return { name: '', studentId: '', phone: '' }
  }
}

export function setStudentInfo(info: { name: string; studentId: string; phone: string }): void {
  Taro.setStorageSync('student_info', info)
}
