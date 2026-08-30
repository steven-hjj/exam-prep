import { createClient } from '@supabase/supabase-js'
import Taro from '@tarojs/taro'
import type { ExamSession, ExamResultRow, Question } from '@/types'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eavkjpsqxgrcjcfrhodx.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''

// 小程序 fetch 适配：用 wx.request 包装成 fetch API
function miniProgramFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = (init?.method || 'GET').toUpperCase()
    let header: Record<string, string> = {}
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          header[key] = value
        })
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          header[key] = value
        })
      } else {
        header = { ...init.headers } as Record<string, string>
      }
    }

    let data = init?.body
    if (data && typeof data !== 'string') {
      try {
        data = JSON.stringify(data)
      } catch {
        // ignore
      }
    }

    Taro.request({
      url,
      method: method as any,
      header,
      data,
      responseType: 'text',
      success: (res) => {
        const body = JSON.stringify(res.data)
        resolve(
          new Response(body, {
            status: res.statusCode,
            statusText: res.statusCode === 200 ? 'OK' : '',
            headers: new Headers(header),
          }),
        )
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '请求失败'))
      },
    })
  })
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'sb-exam-prep-token',
    storage: {
      getItem: (key) => {
        try {
          return Taro.getStorageSync(key)
        } catch {
          return null
        }
      },
      setItem: (key, value) => Taro.setStorageSync(key, value),
      removeItem: (key) => Taro.removeStorageSync(key),
    },
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: miniProgramFetch as any,
  },
})

export async function fetchSessionByCode(code: string): Promise<ExamSession | null> {
  const { data, error } = await supabase
    .from('exam_sessions')
    .select('*')
    .eq('code', code)
    .single()
  if (error || !data) return null
  return {
    ...data,
    paper: data.paper as Question[],
    createdAt: new Date(data.created_at).getTime(),
  } as ExamSession
}

export async function submitExamResult(row: Omit<ExamResultRow, 'id'>): Promise<boolean> {
  const { error } = await supabase.from('exam_results').insert({
    session_code: row.sessionCode,
    student_name: row.studentName,
    student_id: row.studentId,
    student_phone: row.studentPhone || null,
    total: row.total,
    correct: row.correct,
    duration: row.duration,
    violations: row.violations,
    finished_at: new Date(row.finishedAt).toISOString(),
  })
  return !error
}
