import { View, Text, Image } from '@tarojs/components'
import { useMemo } from 'react'

interface MathTextProps {
  text: string
  inline?: boolean
  fontSize?: string
}

const CODECOGS_URL = 'https://latex.codecogs.com/svg.image?'

function hasMath(text: string): boolean {
  return /\$[\s\S]*?\$/.test(text)
}

function escapeLatexText(text: string): string {
  return text.replace(/[{}\\%$#&_^]/g, (c) => `\\${c}`)
}

function toLatexDocument(text: string): string {
  const segments = parseSegments(text)
  const parts = segments.map((seg) => {
    if (seg.type === 'text') {
      return `\\text{${escapeLatexText(seg.content)}}`
    }
    return seg.content
  })
  return parts.join(' ')
}

interface Segment {
  type: 'text' | 'math'
  content: string
  displayMode?: boolean
}

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = []
  let remaining = text

  while (remaining.length > 0) {
    const displayMatch = remaining.match(/^\$\$([\s\S]*?)\$\$/)
    if (displayMatch) {
      segments.push({ type: 'math', content: displayMatch[1], displayMode: true })
      remaining = remaining.slice(displayMatch[0].length)
      continue
    }

    const inlineMatch = remaining.match(/^\$([\s\S]*?)\$/)
    if (inlineMatch) {
      segments.push({ type: 'math', content: inlineMatch[1], displayMode: false })
      remaining = remaining.slice(inlineMatch[0].length)
      continue
    }

    const nextMath = remaining.search(/\$/)
    if (nextMath === -1) {
      segments.push({ type: 'text', content: remaining })
      break
    }

    if (nextMath > 0) {
      segments.push({ type: 'text', content: remaining.slice(0, nextMath) })
      remaining = remaining.slice(nextMath)
    }
  }

  return segments
}

export default function MathText({ text, inline = true, fontSize = '32rpx' }: MathTextProps) {
  const segments = useMemo(() => parseSegments(text), [text])
  const hasAnyMath = useMemo(() => hasMath(text), [text])

  if (!text) return null

  // 包含数学公式时，整段渲染为一张 LaTeX 图片，保证各部分比例一致
  if (hasAnyMath) {
    const latex = toLatexDocument(text)
    const url = `${CODECOGS_URL}${encodeURIComponent(latex)}`
    return (
      <View style={{ width: '100%' }}>
        <Image
          src={url}
          mode="widthFix"
          style={{ width: '100%', height: 'auto' }}
          lazyLoad
        />
      </View>
    )
  }

  // 纯文本直接显示
  return (
    <Text style={{ fontSize, lineHeight: '1.6' }}>
      {text}
    </Text>
  )
}
