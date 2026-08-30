import { View, Text, Image } from '@tarojs/components'
import { useMemo } from 'react'

interface MathTextProps {
  text: string
  inline?: boolean
  fontSize?: string
}

const CODECOGS_URL = 'https://latex.codecogs.com/svg.image?'

function renderMathUrl(latex: string, displayMode = false): string {
  const params = displayMode ? latex : `\\inline ${latex}`
  return `${CODECOGS_URL}${encodeURIComponent(params)}`
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

  if (!text) return null

  return (
    <View style={inline ? { display: 'flex', flexWrap: 'wrap', alignItems: 'center' } : {}}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return (
            <Text key={i} style={{ fontSize, lineHeight: '1.6' }}>
              {seg.content}
            </Text>
          )
        }
        const url = renderMathUrl(seg.content, seg.displayMode)
        if (seg.displayMode) {
          return (
            <View key={i} style={{ width: '100%', textAlign: 'center', marginTop: '12rpx', marginBottom: '12rpx' }}>
              <Image
                src={url}
                mode="widthFix"
                style={{ maxWidth: '100%', height: 'auto' }}
                lazyLoad
              />
            </View>
          )
        }
        return (
          <Image
            key={i}
            src={url}
            mode="heightFix"
            style={{ height: '40rpx', width: 'auto', verticalAlign: 'middle', marginLeft: '4rpx', marginRight: '4rpx' }}
            lazyLoad
          />
        )
      })}
    </View>
  )
}
