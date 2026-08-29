import type { Question, QuestionType } from '@/types'

/**
 * 批量导入文本格式（每题之间用空行分隔）：
 *
 * 【单选】题干内容 [分类:数学] [#标签1] [#标签2]
 * A. 选项一
 * B. 选项二
 * C. 选项三
 * 答案：A
 * 解析：可选解析文字
 *
 * 【多选】... 答案：ABC
 * 【判断】... 答案：对 / 错
 * 【填空】... 答案：参考答案（多空用 | 分隔）
 *
 * 同时支持 JSON 数组导入（字段与 Question 类型一致）。
 */

const TYPE_MAP: Record<string, QuestionType> = {
  单选: 'single',
  单选题: 'single',
  多选: 'multiple',
  多选题: 'multiple',
  判断: 'judge',
  判断题: 'judge',
  填空: 'fill',
  填空题: 'fill',
  大题: 'essay',
  解答: 'essay',
  解答题: 'essay',
  主观: 'essay',
  主观题: 'essay',
}

export interface ParseResult {
  questions: Question[]
  errors: string[]
}

export function parseImportText(text: string, bankId: string): ParseResult {
  const trimmed = text.trim()
  if (!trimmed) return { questions: [], errors: ['内容为空'] }

  // 优先尝试 JSON
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed) as Partial<Question>[]
      const questions: Question[] = arr.map((item, i) => ({
        id: `q-${Date.now()}-${i}`,
        bankId,
        type: item.type ?? 'single',
        category: item.category ?? '未分类',
        tags: item.tags ?? [],
        stem: item.stem ?? '',
        options: item.options,
        answer: item.answer ?? '',
        analysis: item.analysis,
        createdAt: Date.now(),
      }))
      return { questions, errors: [] }
    } catch {
      return { questions: [], errors: ['JSON 解析失败，请检查格式'] }
    }
  }

  const blocks = trimmed.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  const questions: Question[] = []
  const errors: string[] = []

  blocks.forEach((block, idx) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    const header = lines[0] ?? ''
    const typeMatch = header.match(/【(.+?)】/)
    const type = typeMatch ? TYPE_MAP[typeMatch[1]] : undefined

    if (!type) {
      errors.push(`第 ${idx + 1} 题：无法识别题型（需以【单选】/【多选】/【判断】/【填空】开头）`)
      return
    }

    // 提取分类与标签
    const categoryMatch = header.match(/\[分类[:：](.+?)\]/)
    const category = categoryMatch?.[1]?.trim() ?? '未分类'
    const tags = [...header.matchAll(/\[#(.+?)\]/g)].map((m) => m[1].trim())
    const stem = header
      .replace(/【.+?】/, '')
      .replace(/\[分类[:：].+?\]/, '')
      .replace(/\[#.+?\]/g, '')
      .trim()

    const options: string[] = []
    let answer: string | string[] = ''
    let analysis: string | undefined

    for (const line of lines.slice(1)) {
      const optMatch = line.match(/^([A-Z])\s*[.、．]\s*(.+)$/)
      if (optMatch) {
        options.push(optMatch[2].trim())
        continue
      }
      const ansMatch = line.match(/^答案\s*[:：]\s*(.+)$/)
      if (ansMatch) {
        const raw = ansMatch[1].trim()
        if (type === 'judge') {
          answer = /^(对|正确|√|true|T)$/i.test(raw) ? 'true' : 'false'
        } else if (type === 'essay') {
          answer = raw
        } else if (type === 'multiple') {
          answer = raw.replace(/[,，、\s]/g, '').split('').map((s) => s.toUpperCase())
        } else if (type === 'fill') {
          answer = raw.split('|').map((s) => s.trim())
        } else {
          answer = raw.toUpperCase()
        }
        continue
      }
      const anaMatch = line.match(/^解析\s*[:：]\s*(.+)$/)
      if (anaMatch) analysis = anaMatch[1].trim()
    }

    if ((type === 'single' || type === 'multiple') && options.length < 2) {
      errors.push(`第 ${idx + 1} 题：选项不足（至少需要 2 个选项）`)
      return
    }
    if (!answer || (Array.isArray(answer) && answer.length === 0)) {
      errors.push(`第 ${idx + 1} 题：缺少答案`)
      return
    }

    questions.push({
      id: `q-${Date.now()}-${idx}`,
      bankId,
      type,
      category,
      tags,
      stem,
      options: options.length ? options : undefined,
      answer,
      analysis,
      createdAt: Date.now(),
    })
  })

  return { questions, errors }
}

/** 导出当前题库为 JSON（备份/迁移用） */
export function exportQuestionsJSON(questions: Question[]): string {
  return JSON.stringify(questions, null, 2)
}

/**
 * Excel 导入格式（第一行为表头）：
 * 题型 | 题干 | A | B | C | D | E | F | 答案 | 解析 | 分类 | 标签
 * - 题型：单选/多选/判断/填空（必填）
 * - 答案：单选填字母；多选连写如 AC；判断填 对/错；填空直接填参考答案，多空用 | 分隔
 * - 分类/标签可空，标签多个用逗号分隔
 */
export async function parseExcelFile(buffer: ArrayBuffer, bankId: string): Promise<ParseResult> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  const questions: Question[] = []
  const errors: string[] = []

  rows.forEach((row, idx) => {
    const line = idx + 2 // 表头占第 1 行
    const typeRaw = String(row['题型'] ?? '').trim()
    const type = TYPE_MAP[typeRaw]
    const stem = String(row['题干'] ?? '').trim()
    if (!type || !stem) {
      errors.push(`第 ${line} 行：题型或题干缺失（题型需为 单选/多选/判断/填空）`)
      return
    }

    const options = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
      .map((col) => String(row[col] ?? '').trim())
      .filter((s) => s !== '')
    const ansRaw = String(row['答案'] ?? '').trim()
    if (!ansRaw) {
      errors.push(`第 ${line} 行：缺少答案`)
      return
    }

    let answer: string | string[]
    if (type === 'judge') {
      answer = /^(对|正确|√|true|T)$/i.test(ansRaw) ? 'true' : 'false'
    } else if (type === 'essay') {
      answer = ansRaw
    } else if (type === 'multiple') {
      answer = ansRaw.replace(/[,，、\s]/g, '').split('').map((s) => s.toUpperCase())
    } else if (type === 'fill') {
      answer = ansRaw.split('|').map((s) => s.trim())
    } else {
      answer = ansRaw.toUpperCase()
    }

    if ((type === 'single' || type === 'multiple') && options.length < 2) {
      errors.push(`第 ${line} 行：选项不足（A~H 列至少填 2 列）`)
      return
    }

    const category = String(row['分类'] ?? '').trim() || '未分类'
    const tags = String(row['标签'] ?? '')
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const analysis = String(row['解析'] ?? '').trim() || undefined

    questions.push({
      id: `q-${Date.now()}-${idx}`,
      bankId,
      type,
      category,
      tags,
      stem,
      options: options.length ? options : undefined,
      answer,
      analysis,
      createdAt: Date.now(),
    })
  })

  if (rows.length === 0) errors.push('Excel 中没有数据行（第一行需为表头）')
  return { questions, errors }
}

/** Word 导入：提取纯文本后按文本格式解析 */
export async function extractWordText(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return result.value
}

export async function parseWordFile(buffer: ArrayBuffer, bankId: string): Promise<ParseResult> {
  return parseImportText(await extractWordText(buffer), bankId)
}

/**
 * PDF 导入：浏览器端提取文本后按文本格式解析。
 * 适合以文本为主的试卷 PDF；扫描件（图片型 PDF）无文本层无法解析。
 * 数学公式若为标准字符（x^2、sin30°、1/2）可保留，复杂排版公式需导入后人工校对。
 */
export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const doc = await pdfjs.getDocument({ data: buffer }).promise
  const parts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join('')
    parts.push(line)
  }
  return parts.join('\n\n')
}

export async function parsePdfFile(buffer: ArrayBuffer, bankId: string): Promise<ParseResult> {
  const text = await extractPdfText(buffer)
  if (!text.trim()) {
    return { questions: [], errors: ['未从 PDF 中提取到文字（扫描件/图片型 PDF 需要使用网页内的图像识别）'] }
  }
  return parseImportText(text, bankId)
}

/** 将 PDF 页面渲染为图片，供网页内的视觉识别使用（压缩以减小请求体）。 */
export async function renderPdfPages(buffer: ArrayBuffer, maxPages = 20): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const doc = await pdfjs.getDocument({ data: buffer }).promise
  const pages: string[] = []
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale: 1.2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
    pages.push(canvas.toDataURL('image/jpeg', 0.72))
  }
  return pages
}
