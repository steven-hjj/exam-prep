import { useMemo, type ReactNode } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

/**
 * 将文本解析为节点数组：
 * - 普通文本直接输出
 * - $...$ / $$...$$ 公式用 KaTeX 渲染
 * - 渲染失败时降级为等宽字体的代码块（保留可读性，不出现 &lt; 等实体）
 * 不再返回 HTML 字符串，根除 dangerouslySetInnerHTML 拼接导致的实体显示问题。
 */
function tokenize(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g
  let cursor = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = regex.exec(text)) !== null) {
    if (m.index > cursor) out.push(text.slice(cursor, m.index))
    const tok = m[0]
    const displayMode = tok.startsWith('$$')
    const formula = tok.replace(/^\$+|\$+$/g, '')
    try {
      const html = katex.renderToString(formula, { displayMode, throwOnError: true, strict: false, output: 'html' })
      out.push(<span key={key++} dangerouslySetInnerHTML={{ __html: html }} />)
    } catch {
      out.push(
        <code
          key={key++}
          className="mx-0.5 inline-block whitespace-pre-wrap rounded bg-red-50 px-1.5 py-0.5 font-mono text-[0.9em] text-red-700 ring-1 ring-red-200"
          title="公式渲染失败：老师请检查 LaTeX 语法"
        >
          {formula}
        </code>,
      )
    }
    cursor = m.index + tok.length
  }
  if (cursor < text.length) out.push(text.slice(cursor))
  return out
}

interface MathTextProps {
  text: string
  className?: string
}

export function MathText({ text, className }: MathTextProps) {
  const nodes = useMemo(() => tokenize(text), [text])
  return <span className={className}>{nodes}</span>
}
