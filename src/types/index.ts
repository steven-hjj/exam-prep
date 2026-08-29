/** 题型：单选 / 多选 / 判断 / 填空 */
export type QuestionType = 'single' | 'multiple' | 'judge' | 'fill' | 'essay'

/** 题库（考试宝式多题库模型：每套题库存放一组题目） */
export interface Bank {
  id: string
  /** 题库编码（如 BK-7F3K），便于快速查找与口口相传 */
  code: string
  name: string
  /** 科目（数学/物理/英语……） */
  subject: string
  /** 学段或年级（如 高三 / AP / IGCSE，选填） */
  grade?: string
  description: string
  createdAt: number
}

/** 科目预设列表 */
export const SUBJECTS = ['数学', '物理', '化学', '生物', '英语', '语文', '历史', '地理', '政治', '信息技术', '其他'] as const

/** 生成题库短码：BK-XXXX（易读字符集，去 0/O/1/I/L） */
export function genBankCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const rand = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `BK-${rand}`
}

export interface Question {
  id: string
  /** 所属题库 */
  bankId: string
  type: QuestionType
  /** 学科分类（如：数学 / 英语 / 计算机基础） */
  category: string
  /** 知识点标签（如：三角函数、易错、高频考点） */
  tags: string[]
  /** 题干 */
  stem: string
  /** 选项（单选/多选用） */
  options?: string[]
  /**
   * 答案约定：
   * - single: 'A'
   * - multiple: ['A', 'C']
   * - judge: 'true' | 'false'
   * - fill: ['参考答案1', '参考答案2']（多空按顺序）
   */
  answer: string | string[]
  /** 解析 */
  analysis?: string
  /** 难度 1-5，默认 3 */
  difficulty?: number
  /** 来源/出处（如试卷名、页码） */
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

/** 防作弊违规记录 */
export interface Violation {
  type: 'blur' | 'hidden' | 'copy' | 'shortcut' | 'contextmenu' | 'fullscreen-exit' | 'navigation'
  label: string
  time: number
}

/** 一次考试/练习的成绩记录 */
export interface ExamRecord {
  id: string
  mode: 'practice' | 'exam'
  total: number
  correct: number
  /** 秒 */
  duration: number
  violations: number
  finishedAt: number
}

export interface AnswerMap {
  [questionId: string]: string | string[]
}

/** 判分 */
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
  // essay（解答题）：不自动判分，由学生对照参考答案自评
  if (q.type === 'essay') {
    return userAnswer === 'self:correct'
  }
  // fill：逐空比对（忽略大小写与首尾空格）
  const expected = Array.isArray(q.answer) ? q.answer : [q.answer]
  const actual = Array.isArray(userAnswer) ? userAnswer : [userAnswer]
  return expected.every(
    (ans, i) => (actual[i] ?? '').trim().toLowerCase() === ans.trim().toLowerCase(),
  )
}

/** 是否为客观题（可自动判分） */
export function isObjective(q: Question): boolean {
  return q.type !== 'essay'
}

/** 老师发起的考试场次 */
export interface ExamSession {
  id: string
  code: string
  teacherId: string
  title: string
  minutes: number
  fullscreen: boolean
  /** 试卷快照（题目数组） */
  paper: Question[]
  createdAt: number
}

/** 学生交卷成绩 */
export interface ExamResultRow {
  id: string
  sessionCode: string
  studentName: string
  /** 学号（必填，唯一标识，重名也可区分） */
  studentId: string
  /** 手机号（选填） */
  studentPhone?: string
  total: number
  correct: number
  duration: number
  violations: Violation[]
  finishedAt: number
}

/** 套餐方案 */
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

/** 各套餐上限（暂不含价格） */
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
