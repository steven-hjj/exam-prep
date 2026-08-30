/** 题型：单选 / 多选 / 判断 / 填空 / 解答 */
export type QuestionType = 'single' | 'multiple' | 'judge' | 'fill' | 'essay'

export interface Bank {
  id: string
  code: string
  name: string
  subject: string
  grade?: string
  description: string
  createdAt: number
}

export const SUBJECTS = ['数学', '物理', '化学', '生物', '英语', '语文', '历史', '地理', '政治', '信息技术', '其他'] as const

export function genBankCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const rand = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `BK-${rand}`
}

export interface Question {
  id: string
  bankId: string
  type: QuestionType
  category: string
  tags: string[]
  stem: string
  options?: string[]
  answer: string | string[]
  analysis?: string
  difficulty?: number
  source?: string
  createdAt: number
}

export const TYPE_LABEL: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  fill: '填空题',
  essay: '解答题',
}

export interface Violation {
  type: 'blur' | 'hidden' | 'copy' | 'shortcut' | 'contextmenu' | 'fullscreen-exit' | 'navigation' | 'absence' | 'rapid-switch' | 'fast-answer' | 'suspicious-pattern'
  label: string
  time: number
  meta?: Record<string, unknown>
}

export interface AnswerMap {
  [questionId: string]: string | string[]
}

export function gradeQuestion(q: Question, userAnswer: string | string[] | undefined): boolean {
  if (userAnswer === undefined || userAnswer === '' || (Array.isArray(userAnswer) && userAnswer.length === 0)) {
    return false
  }
  if (q.type === 'single' || q.type === 'judge') {
    return String(userAnswer) === String(q.answer)
  }
  if (q.type === 'multiple') {
    const a = [...(userAnswer as string[])].sort().join(',')
    const b = [...(q.answer as string[])].sort().join(',')
    return a === b
  }
  if (q.type === 'essay') {
    return userAnswer === 'self:correct'
  }
  const expected = Array.isArray(q.answer) ? q.answer : [q.answer]
  const actual = Array.isArray(userAnswer) ? userAnswer : [userAnswer]
  return expected.every(
    (ans, i) => (actual[i] ?? '').trim().toLowerCase() === ans.trim().toLowerCase(),
  )
}

export function isObjective(q: Question): boolean {
  return q.type !== 'essay'
}

export interface ExamSession {
  id: string
  code: string
  teacherId: string
  title: string
  minutes: number
  fullscreen: boolean
  paper: Question[]
  createdAt: number
}

export interface ExamResultRow {
  id: string
  sessionCode: string
  studentName: string
  studentId: string
  studentPhone?: string
  total: number
  correct: number
  duration: number
  violations: Violation[]
  finishedAt: number
  answers?: AnswerMap
}

export type PlanType = 'free' | 'teacher' | 'school'

export interface Subscription {
  userId: string
  plan: PlanType
  expiresAt?: number
  maxBanks: number
  maxQuestions: number
  maxExamsMonthly: number
  maxStudentsMonthly: number
  aiPagesMonthly: number
  createdAt: number
  updatedAt: number
}

export interface UsageStats {
  id?: string
  userId: string
  yearMonth: string
  examsCreated: number
  studentsReached: number
  aiPagesUsed: number
}

export const PLAN_LIMITS: Record<PlanType, Omit<Subscription, 'userId' | 'createdAt' | 'updatedAt' | 'expiresAt'>> = {
  free: {
    plan: 'free',
    maxBanks: 3,
    maxQuestions: 100,
    maxExamsMonthly: 10,
    maxStudentsMonthly: 100,
    aiPagesMonthly: 0,
  },
  teacher: {
    plan: 'teacher',
    maxBanks: 9999,
    maxQuestions: 5000,
    maxExamsMonthly: 9999,
    maxStudentsMonthly: 9999,
    aiPagesMonthly: 500,
  },
  school: {
    plan: 'school',
    maxBanks: 9999,
    maxQuestions: 50000,
    maxExamsMonthly: 9999,
    maxStudentsMonthly: 9999,
    aiPagesMonthly: 5000,
  },
}

export const PLAN_LABEL: Record<PlanType, string> = {
  free: '免费版',
  teacher: '教师版',
  school: '学校版',
}
