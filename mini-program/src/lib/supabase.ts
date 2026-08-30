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
  const cached = getCachedSession(code)
  if (cached) return cached

  try {
    const res = await Taro.request({
      url: `${SUPABASE_URL}/rest/v1/exam_sessions?code=eq.${encodeURIComponent(code)}&select=*`,
      method: 'GET',
      header: getAuthHeaders(),
      timeout: REQUEST_TIMEOUT,
    })

    let data: unknown = res.data
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch {
        return null
      }
    }

    if (res.statusCode !== 200 || !Array.isArray(data) || data.length === 0) {
      return null
    }

    const row = data[0] as Record<string, unknown>
    const session = {
      ...row,
      teacherId: row.teacher_id as string,
      paper: row.paper as Question[],
      createdAt: new Date(row.created_at as string).getTime(),
    } as ExamSession

    setCachedSession(code, session)
    return session
  } catch (e) {
    console.error('fetchSessionByCode error', e)
    return null
  }
}

export async function submitExamResult(row: Omit<ExamResultRow, 'id'>, teacherId: string): Promise<boolean> {
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
