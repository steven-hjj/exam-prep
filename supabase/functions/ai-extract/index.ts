// Supabase Edge Function：AI 试卷识别（终极诊断版 + 自动分类）
// 核心改进：
// 1. 中转站返回 200 但内容为空时，明确报"模型返回空内容"并附上中转站原始响应
// 2. JSON 解析多重容错（自动修复 LaTeX 反斜杠）
// 3. 任何错误都附带完整诊断信息（Key 前缀/长度、URL、原始响应）
// 4. AI 自动输出学科、知识点、难度、来源等分类字段

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `你是试卷题目结构化助手。用户会给你若干张试卷页面图片或一段试卷文字，请识别其中的全部题目并整理为题目 JSON 数组。

输出要求（严格遵守）：
1. 只输出一个 JSON 数组，不要任何其他文字、解释或 markdown 代码块
2. 每个元素字段：
   - type: "single" | "multiple" | "judge" | "fill" | "essay"
   - stem: 题干（字符串）
   - options: 选项数组（仅 single/multiple 需要，不含 A/B/C 前缀）
   - answer: 单选为字母如 "A"；多选为字母数组；判断为 "true"/"false"；填空为答案数组；essay 为参考答案文字
   - category: 学科分类，从"数学、物理、化学、生物、英语、语文、历史、地理、政治、信息技术、其他"中推断，推断不出用"未分类"
   - tags: 知识点标签数组（3-5 个，如"三角函数、易错、高频考点"）
   - difficulty: 难度整数 1-5（1=极易，5=极难；根据题目复杂度判断，默认 3）
   - source: 来源/出处（如试卷名、页码；若无法推断则省略该字段）
   - analysis: 解析（能推断则写，否则省略该字段）
3. 所有数学公式一律用 LaTeX 表示并用 $...$ 包裹，独立公式用 $$...$$
4. 图片/图形题：在题干中用 [图] 标注位置
5. 按试卷原始题号顺序输出，不要遗漏任何题目`

/** 从模型回复中稳健提取最外层 JSON 数组（去掉 markdown 代码块、处理嵌套括号） */
function extractJsonArray(reply: string): string | null {
  // 先去掉 markdown 代码块标记（保留内部内容）
  const cleaned = reply
    .replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .trim()

  const start = cleaned.indexOf('[')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\' && inString) {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (!inString) {
      if (ch === '[') depth++
      else if (ch === ']') {
        depth--
        if (depth === 0) return cleaned.slice(start, i + 1)
      }
    }
  }

  // 兜底：如果括号没配平，取第一个 '[' 到最后一个 ']'
  const end = cleaned.lastIndexOf(']')
  if (end > start) return cleaned.slice(start, end + 1)
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const baseUrl = Deno.env.get('AI_BASE_URL') ?? 'https://hapiopen.cc/v1'
  const apiKey = Deno.env.get('AI_API_KEY') ?? ''
  const model = Deno.env.get('AI_MODEL') ?? 'gpt-5.5'
  const diag = {
    baseUrl, model,
    apiKeyLength: apiKey.length,
    apiKeyPrefix: apiKey ? apiKey.slice(0, 8) + '...' : '(empty)',
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ error: '服务端未配置 AI_API_KEY', diag }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  let body: { images?: string[]; text?: string; context?: string; sourceHint?: string }
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: '请求体不是合法 JSON' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const images = body.images ?? []
  const text = body.text ?? ''
  const context = body.context ?? ''
  const sourceHint = body.sourceHint ?? ''
  if (images.length === 0 && !text.trim()) {
    return new Response(JSON.stringify({ error: '缺少页面图片或试卷文字' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const contextPrefix = context ? `【批次上下文】${context}。请只输出这几页里的题目，不要重复之前已识别的内容。\n\n` : ''
  const sourceInstruction = sourceHint
    ? `这些题目来自：${sourceHint}。请在每道题的 source 字段尽量包含该来源信息。\n\n`
    : ''
  const content = images.length > 0
    ? [
        { type: 'text', text: contextPrefix + sourceInstruction + '请识别这些试卷页面中的全部题目，严格只返回题目 JSON 数组，按题号顺序，数学公式转为 LaTeX。' },
        ...images.slice(0, 20).map((image) => ({ type: 'image_url', image_url: { url: image } })),
      ]
    : [{ type: 'text', text: contextPrefix + sourceInstruction + `请把以下试卷文字整理为题目 JSON 数组，严格只返回 JSON 数组，数学公式转为 LaTeX：\n\n${text}` }]

  let resp: Response
  let respText = ''
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content }],
        temperature: 0.1,
        max_tokens: 16384,
      }),
    })
    respText = await resp.text()
  } catch (e) {
    return new Response(JSON.stringify({
      error: 'fetch 异常（DNS/网络）',
      detail: String(e),
      diag: { ...diag, url },
    }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // 无论状态码如何，只要 body 里有错误码就原样透传（中转站有时 200 + 错误内容）
  if (!resp.ok || /INVALID_API_KEY|insufficient|quota/i.test(respText)) {
    return new Response(JSON.stringify({
      error: `中转站拒绝（HTTP ${resp.status}）`,
      relayResponse: respText.slice(0, 500),
      diag: { ...diag, url },
    }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  let data: { choices?: { message?: { content?: string }; finish_reason?: string }[] }
  try { data = JSON.parse(respText) } catch {
    return new Response(JSON.stringify({
      error: '中转站返回的不是 JSON',
      relayResponse: respText.slice(0, 500),
      diag: { ...diag, url },
    }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const reply: string = data?.choices?.[0]?.message?.content ?? ''
  // 关键：中转站 200 但内容为空（无效 Key 的常见表现）
  if (!reply.trim()) {
    return new Response(JSON.stringify({
      error: '模型返回空内容（Key 可能无效或额度不足）',
      relayResponse: respText.slice(0, 800),
      diag: { ...diag, url },
    }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const finishReason: string = data?.choices?.[0]?.finish_reason ?? ''
  if (finishReason === 'length') {
    return new Response(JSON.stringify({
      error: '模型输出被 max_tokens 截断',
      diag: { ...diag, url },
    }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // 从模型回复中稳健地提取最外层 JSON 数组
  const jsonText = extractJsonArray(reply)
  if (!jsonText) {
    return new Response(JSON.stringify({
      error: 'AI 未返回有效题目 JSON',
      modelReply: reply.slice(0, 1200),
      diag: { ...diag, url },
    }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // JSON 解析：严格 → 清理常见格式问题 → 修复 LaTeX 反斜杠 → 失败回传原文
  let questions: unknown
  try {
    questions = JSON.parse(jsonText)
  } catch {
    try {
      const repaired = jsonText
        // 去掉行尾注释
        .replace(/\/\/[^\n]*/g, '')
        // 修复未转义的单引号：把 JSON 字符串里的 ' 换成 \'
        .replace(/(?<=: ?')[^'\n]*'/g, (m) => m.replace(/'$/, "\\'"))
        // 修复 LaTeX 单反斜杠：\frac -> \\frac
        .replace(/\\([a-zA-Z])/g, '\\\\$1')
        // 去掉对象/数组末尾多余逗号
        .replace(/,(\s*[}\]])/g, '$1')
      questions = JSON.parse(repaired)
    } catch (secondErr) {
      return new Response(JSON.stringify({
        error: '题目 JSON 解析失败',
        detail: String(secondErr),
        modelReply: jsonText.slice(0, 2000),
        diag: { ...diag, url },
      }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
  }

  return new Response(JSON.stringify({ questions }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
