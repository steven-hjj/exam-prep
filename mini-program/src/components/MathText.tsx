import { View, Text, Image } from '@tarojs/components'
import { memo, useMemo, useState } from 'react'

interface MathTextProps {
  text: string
  inline?: boolean
  fontSize?: string
}

const CODECOGS_URL = 'https://latex.codecogs.com/svg.image?'
const INLINE_IMAGE_HEIGHT = '36rpx'
const INLINE_IMAGE_MARGIN = '4rpx'

function renderMathUrl(latex: string, displayMode = false): string {
  const size = displayMode ? '\\displaystyle' : '\\inline'
  return `${CODECOGS_URL}${encodeURIComponent(`${size} ${latex}`)}`
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

interface MathImageProps {
  latex: string
  displayMode?: boolean
  fallback: string
}

function MathImage({ latex, displayMode = false, fallback }: MathImageProps) {
  const [error, setError] = useState(false)
  const url = useMemo(() => renderMathUrl(latex, displayMode), [latex, displayMode])

  if (error) {
    return <Text style={{ fontSize: '32rpx', lineHeight: '1.6' }}>{fallback}</Text>
  }

  if (displayMode) {
    return (
      <View style={{ width: '100%', textAlign: 'center', marginTop: '12rpx', marginBottom: '12rpx' }}>
        <Image
          src={url}
          mode="widthFix"
          style={{ maxWidth: '100%', height: 'auto' }}
          lazyLoad
          onError={() => setError(true)}
        />
      </View>
    )
  }

  return (
    <Image
      src={url}
      mode="heightFix"
      style={{
        height: INLINE_IMAGE_HEIGHT,
        width: 'auto',
        verticalAlign: 'middle',
        marginLeft: INLINE_IMAGE_MARGIN,
        marginRight: INLINE_IMAGE_MARGIN,
      }}
      lazyLoad
      onError={() => setError(true)}
    />
  )
}

export default memo(function MathText({ text, inline = true, fontSize = '32rpx' }: MathTextProps) {
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
        return (
          <MathImage
            key={i}
            latex={seg.content}
            displayMode={seg.displayMode}
            fallback={`$${seg.content}$`}
          />
        )
      })}
    </View>
  )
})
