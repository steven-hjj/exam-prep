import type { Question, QuestionType } from '@/types'
import type { ParseResult } from '@/lib/parser'

/**
 * AI 识别：浏览器只 POST 我们自己的 Supabase Edge Function。
 * Key 保存在 Supabase Secrets（服务端），浏览器、前端代码、部署包中无任何密钥。
 */

const VALID_TYPES: QuestionType[] = ['single', 'multiple', 'judge', 'fill', 'essay']

function edgeUrl(): string {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '')
  return `${url}/functions/v1/ai-extract`
}

interface EdgeResponse {
  questions?: Partial<Question>[]
  error?: string
  diag?: { baseUrl?: string; model?: string; apiKeyLength?: number; apiKeyPrefix?: string; url?: string }
  modelReply?: string
  relayResponse?: string
}

async function callEdge(body: Record<string, unknown>): Promise<EdgeResponse> {
  const url = edgeUrl()
  if (!url.startsWith('http')) return { error: '未配置云端服务' }
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(anonKey ? { Authorization: `Bearer ${anonKey}` } : {}),
      },
      body: JSON.stringify(body),
    })
    return await resp.json().catch(() => ({ error: `服务异常（${resp.status}）` }))
  } catch {
    return { error: '无法连接识别服务，请检查网络' }
  }
}

function formatError(data: EdgeResponse): string {
  let msg = data.error ?? '识别服务未返回有效题目'
  if (data.relayResponse) msg += `\n[中转站原始响应] ${data.relayResponse.slice(0, 300)}`
  if (data.modelReply) msg += `\n[模型回复] ${data.modelReply.slice(0, 300)}`
  if (data.diag) {
    const { baseUrl, model, apiKeyLength, apiKeyPrefix, url } = data.diag
    msg += `\n[诊断] baseUrl=${baseUrl} | model=${model} | apiKey=${apiKeyPrefix} (长度 ${apiKeyLength}) | 请求URL=${url}`
  }
  return msg
}

function toQuestions(arr: Partial<Question>[], bankId: string, sourceHint?: string): { questions: Question[]; errors: string[] } {
  const questions: Question[] = []
  const errors: string[] = []
  arr.forEach((item, i) => {
    if (!item.stem || !item.type || !VALID_TYPES.includes(item.type)) {
      errors.push(`第 ${i + 1} 条识别结果字段不完整，已跳过`)
      return
    }
    const difficulty = typeof item.difficulty === 'number' && item.difficulty >= 1 && item.difficulty <= 5 ? item.difficulty : 3
    const source = item.source ? String(item.source) : (sourceHint || undefined)
    questions.push({
      id: `q-ai-${Date.now()}-${i}`,
      bankId,
      type: item.type,
      category: item.category ?? '未分类',
      tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
      stem: String(item.stem),
      options: Array.isArray(item.options) && item.options.length ? item.options.map(String) : undefined,
      answer: item.answer ?? '',
      analysis: item.analysis ? String(item.analysis) : undefined,
      difficulty,
      source,
      createdAt: Date.now(),
    })
  })
  return { questions, errors }
}

export async function aiExtractQuestionsFromImages(images: string[], bankId: string, batchContext?: string, sourceHint?: string): Promise<ParseResult> {
  const data = await callEdge({ images, context: batchContext, sourceHint })
  if (data.error || !Array.isArray(data.questions)) {
    return { questions: [], errors: [formatError(data)] }
  }
  return toQuestions(data.questions, bankId, sourceHint)
}

export async function aiExtractQuestionsFromText(rawText: string, bankId: string, sourceHint?: string): Promise<ParseResult> {
  const data = await callEdge({ text: rawText.slice(0, 24000), sourceHint })
  if (data.error || !Array.isArray(data.questions)) {
    return { questions: [], errors: [formatError(data)] }
  }
  return toQuestions(data.questions, bankId, sourceHint)
}
