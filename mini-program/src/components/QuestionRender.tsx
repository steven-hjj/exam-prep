import { View, Text, Label, RadioGroup, Radio, CheckboxGroup, Checkbox, Input, Textarea } from '@tarojs/components'
import type { Question } from '@/types'

const OPTION_LABEL = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

interface Props {
  question: Question
  index: number
  value?: string | string[]
  onChange: (value: string | string[]) => void
}

export default function QuestionRender({ question, index, value, onChange }: Props) {
  const q = question

  const renderOptions = () => {
    if (!q.options || q.options.length === 0) return null
    if (q.type === 'single') {
      return (
        <RadioGroup onChange={(e) => onChange(e.detail.value)}>
          {q.options.map((opt, i) => (
            <LabelRadio key={i} label={OPTION_LABEL[i]} text={opt} value={OPTION_LABEL[i]} checked={value === OPTION_LABEL[i]} />
          ))}
        </RadioGroup>
      )
    }
    if (q.type === 'multiple') {
      const selected = Array.isArray(value) ? value : []
      return (
        <CheckboxGroup onChange={(e) => onChange(e.detail.value)}>
          {q.options.map((opt, i) => (
            <LabelCheckbox key={i} label={OPTION_LABEL[i]} text={opt} value={OPTION_LABEL[i]} checked={selected.includes(OPTION_LABEL[i])} />
          ))}
        </CheckboxGroup>
      )
    }
    return null
  }

  const renderJudge = () => (
    <RadioGroup onChange={(e) => onChange(e.detail.value)}>
      <LabelRadio label="对" text="正确" value="true" checked={value === 'true'} />
      <LabelRadio label="错" text="错误" value="false" checked={value === 'false'} />
    </RadioGroup>
  )

  const renderFill = () => {
    const count = Array.isArray(q.answer) ? q.answer.length : 1
    const vals = Array.isArray(value) ? value : Array(count).fill('')
    return (
      <View>
        {Array.from({ length: count }).map((_, i) => (
          <Input
            key={i}
            className="input mt-2"
            placeholder={`第 ${i + 1} 空答案`}
            value={vals[i] || ''}
            onInput={(e) => {
              const next = [...vals]
              next[i] = e.detail.value
              onChange(next)
            }}
          />
        ))}
      </View>
    )
  }

  const renderEssay = () => (
    <Textarea
      className="input mt-2"
      style={{ height: '200rpx', paddingTop: '16rpx', paddingBottom: '16rpx' }}
      placeholder="请在此输入作答内容"
      value={typeof value === 'string' ? value : ''}
      onInput={(e) => onChange(e.detail.value)}
    />
  )

  return (
    <View className="card mt-4">
      <Text className="text-muted">第 {index + 1} 题</Text>
      <View style={{ marginTop: '12rpx' }}>
        <Text style={{ fontSize: '32rpx', lineHeight: '1.6' }}>{q.stem}</Text>
      </View>
      {q.type === 'single' && renderOptions()}
      {q.type === 'multiple' && renderOptions()}
      {q.type === 'judge' && renderJudge()}
      {q.type === 'fill' && renderFill()}
      {q.type === 'essay' && renderEssay()}
    </View>
  )
}

function LabelRadio({ label, text, value, checked }: { label: string; text: string; value: string; checked?: boolean }) {
  return (
    <Label style={{ display: 'flex', alignItems: 'center', padding: '16rpx 0' }}>
      <Radio value={value} checked={checked} />
      <Text style={{ marginLeft: '12rpx', fontSize: '30rpx' }}>
        {label}. {text}
      </Text>
    </Label>
  )
}

function LabelCheckbox({ label, text, value, checked }: { label: string; text: string; value: string; checked?: boolean }) {
  return (
    <Label style={{ display: 'flex', alignItems: 'center', padding: '16rpx 0' }}>
      <Checkbox value={value} checked={checked} />
      <Text style={{ marginLeft: '12rpx', fontSize: '30rpx' }}>
        {label}. {text}
      </Text>
    </Label>
  )
}
