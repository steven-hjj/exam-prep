import Taro from '@tarojs/taro'
import type { ExamResultRow } from '@/types'

const RESULTS_KEY = 'exam_results_local'

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
