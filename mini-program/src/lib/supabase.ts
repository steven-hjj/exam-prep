import Taro from '@tarojs/taro'
import type { ExamSession, ExamResultRow, Question } from '@/types'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eavkjpsqxgrcjcfrhodx.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_gd0qrPYJZg4EU63ME3Z3Eg_sF2VMR8K'

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
}

function getAuthHeaders() {
  return headers
}

/**
 * 微信小程序不能直接导入 @supabase/supabase-js（依赖浏览器 Headers/Response）。
 * 这里用 Taro.request 直接调 Supabase REST API。
 */

export async function fetchSessionByCode(code: string): Promise<ExamSession | null> {
  try {
    const res = await Taro.request({
      url: `${SUPABASE_URL}/rest/v1/exam_sessions?code=eq.${encodeURIComponent(code)}&select=*`,
      method: 'GET',
      header: getAuthHeaders(),
    })
    console.log('fetchSessionByCode response', res.statusCode, typeof res.data, res.data)
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
    return {
      ...row,
      paper: row.paper as Question[],
      createdAt: new Date(row.created_at as string).getTime(),
    } as ExamSession
  } catch (e) {
    console.error('fetchSessionByCode error', e)
    return null
  }
}

export async function submitExamResult(row: Omit<ExamResultRow, 'id'>): Promise<boolean> {
  try {
    const res = await Taro.request({
      url: `${SUPABASE_URL}/rest/v1/exam_results`,
      method: 'POST',
      header: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      data: {
        session_code: row.sessionCode,
        student_name: row.studentName,
        student_id: row.studentId,
        student_phone: row.studentPhone || null,
        total: row.total,
        correct: row.correct,
        duration: row.duration,
        violations: row.violations,
        finished_at: new Date(row.finishedAt).toISOString(),
      },
    })
    console.log('submitExamResult response', res.statusCode, res.data)
    return res.statusCode >= 200 && res.statusCode < 300
  } catch (e) {
    console.error('submitExamResult error', e)
    return false
  }
}
