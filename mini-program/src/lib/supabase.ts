import Taro from '@tarojs/taro'
import type { ExamSession, ExamResultRow, Question } from '@/types'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eavkjpsqxgrcjcfrhodx.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_gd0qrPYJZg4EU63ME3Z3Eg_sF2VMR8K'

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
}

const REQUEST_TIMEOUT = 15000
const MAX_RETRY = 3

export class MiniApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = 'MiniApiError'
  }
}

function getAuthHeaders() {
  return headers
}

/**
 * 微信小程序不能直接导入 @supabase/supabase-js（依赖浏览器 Headers/Response）。
 * 这里用 Taro.request 直接调 Supabase REST API。
 */

// 简单缓存：同一考试码 5 分钟内不重复请求
const sessionCache = new Map<string, { data: ExamSession; expiry: number }>()
const CACHE_TTL = 5 * 60 * 1000

function getCachedSession(code: string): ExamSession | null {
  const cached = sessionCache.get(code)
  if (!cached) return null
  if (Date.now() > cached.expiry) {
    sessionCache.delete(code)
    return null
  }
  return cached.data
}

function setCachedSession(code: string, data: ExamSession): void {
  sessionCache.set(code, { data, expiry: Date.now() + CACHE_TTL })
}

export async function fetchSessionByCode(code: string): Promise<ExamSession | null> {
  const normalizedCode = code.trim().toUpperCase()
  const cached = getCachedSession(normalizedCode)
  if (cached) return cached

  const res = await Taro.request({
    url: `${SUPABASE_URL}/rest/v1/exam_sessions?code=eq.${encodeURIComponent(normalizedCode)}&select=*`,
    method: 'GET',
    header: getAuthHeaders(),
    timeout: REQUEST_TIMEOUT,
  })

  let data: unknown = res.data
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      throw new MiniApiError('考试接口返回的不是有效 JSON', res.statusCode, res.data)
    }
  }

  if (res.statusCode !== 200) {
    throw new MiniApiError('考试接口请求失败', res.statusCode, data)
  }

  if (!Array.isArray(data)) {
    throw new MiniApiError('考试接口返回结构错误：预期为数组', res.statusCode, data)
  }

  if (data.length === 0) {
    return null
  }

  const row = data[0] as Record<string, unknown>
  const paper = row.paper
  if (!Array.isArray(paper)) {
    throw new MiniApiError('考试数据结构错误：paper 不是题目数组', res.statusCode, row)
  }

  const session = {
    ...row,
    code: String(row.code ?? normalizedCode),
    teacherId: row.teacher_id as string,
    paper: paper as Question[],
    createdAt: new Date(row.created_at as string).getTime(),
  } as ExamSession

  setCachedSession(normalizedCode, session)
  return session
}

export async function submitExamResult(
  row: Omit<ExamResultRow, 'id'>,
  teacherId: string,
  submissionId?: string,
): Promise<boolean> {
  const payload = {
    session_code: row.sessionCode,
    teacher_id: teacherId,
    student_name: row.studentName,
    student_id: row.studentId,
    student_phone: row.studentPhone || null,
    total: row.total,
    correct: row.correct,
    duration: row.duration,
    violations: row.violations,
    finished_at: new Date(row.finishedAt).toISOString(),
    answers: row.answers || null,
    submission_id: submissionId || null,
  }

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const res = await Taro.request({
        url: `${SUPABASE_URL}/rest/v1/exam_results`,
        method: 'POST',
        header: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        data: payload,
        timeout: REQUEST_TIMEOUT,
      })

      if (res.statusCode >= 200 && res.statusCode < 300) {
        return true
      }

      if (res.statusCode === 409) {
        // 唯一约束冲突说明已提交过，视为成功
        console.warn('submitExamResult conflict, treat as success')
        return true
      }

      if (res.statusCode >= 400 && res.statusCode < 500) {
        // 4xx 错误不重试
        console.error('submitExamResult client error', res.statusCode, res.data)
        return false
      }
    } catch (e) {
      console.error(`submitExamResult attempt ${attempt} error`, e)
      if (attempt === MAX_RETRY) return false
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    }
  }
  return false
}
