import { View, Text, Label, RadioGroup, Radio, CheckboxGroup, Checkbox, Input, Textarea } from '@tarojs/components'
import { memo, useCallback } from 'react'
import { TYPE_LABEL, type Question } from '@/types'
import MathText from '@/components/MathText'

const OPTION_LABEL = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

interface Props {
  question: Question
  index: number
  value?: string | string[]
  onChange: (value: string | string[]) => void
}

interface OptionItemProps {
  label: string
  text: string
  value: string
  checked?: boolean
  type: 'radio' | 'checkbox'
}

const OptionItem = memo(function OptionItem({ label, text, value, checked, type }: OptionItemProps) {
  const isRadio = type === 'radio'
  const Component = isRadio ? Radio : Checkbox

  return (
    <Label style={{ display: 'flex', alignItems: 'center', padding: '16rpx 0' }}>
      <Component value={value} checked={checked} />
      <View style={{ marginLeft: '12rpx', flex: 1 }}>
        <MathText text={`${label}. ${text}`} fontSize="30rpx" />
      </View>
    </Label>
  )
})

export default memo(function QuestionRender({ question, index, value, onChange }: Props) {
  const q = question

  const handleSingleChange = useCallback(
    (e: { detail: { value: string } }) => {
      onChange(e.detail.value)
    },
    [onChange],
  )

  const handleMultipleChange = useCallback(
    (e: { detail: { value: string[] } }) => {
      onChange(e.detail.value)
    },
    [onChange],
  )

  const handleFillChange = useCallback(
    (index: number, newValue: string) => {
      const vals = Array.isArray(value) ? [...value] : []
      vals[index] = newValue
      onChange(vals)
    },
    [value, onChange],
  )

  const handleEssayChange = useCallback(
    (e: { detail: { value: string } }) => {
      onChange(e.detail.value)
    },
    [onChange],
  )

  const renderOptions = () => {
    if (!q.options || q.options.length === 0) return null

    if (q.type === 'single') {
      return (
        <RadioGroup onChange={handleSingleChange}>
          {q.options.map((opt, i) => (
            <OptionItem
              key={i}
              label={OPTION_LABEL[i]}
              text={opt}
              value={OPTION_LABEL[i]}
              checked={value === OPTION_LABEL[i]}
              type="radio"
            />
          ))}
        </RadioGroup>
      )
    }

    if (q.type === 'multiple') {
      const selected = Array.isArray(value) ? value : []
      return (
        <CheckboxGroup onChange={handleMultipleChange}>
          {q.options.map((opt, i) => (
            <OptionItem
              key={i}
              label={OPTION_LABEL[i]}
              text={opt}
              value={OPTION_LABEL[i]}
              checked={selected.includes(OPTION_LABEL[i])}
              type="checkbox"
            />
          ))}
        </CheckboxGroup>
      )
    }

    return null
  }

  const renderJudge = () => (
    <RadioGroup onChange={handleSingleChange}>
      <OptionItem label="对" text="正确" value="true" checked={value === 'true'} type="radio" />
      <OptionItem label="错" text="错误" value="false" checked={value === 'false'} type="radio" />
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
            onInput={(e) => handleFillChange(i, e.detail.value)}
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
      onInput={handleEssayChange}
    />
  )

  return (
    <View className="card mt-4">
      <View style={{ display: 'flex', alignItems: 'center', gap: '12rpx' }}>
        <Text className="text-muted">第 {index + 1} 题</Text>
        <Text style={{ padding: '4rpx 12rpx', borderRadius: '999rpx', background: '#eef2ff', color: '#3730a3', fontSize: '24rpx', fontWeight: 600 }}>
          {TYPE_LABEL[q.type] ?? '题目'}
        </Text>
      </View>
      <View style={{ marginTop: '12rpx' }}>
        <MathText text={q.stem} fontSize="32rpx" />
      </View>
      {q.type === 'single' && renderOptions()}
      {q.type === 'multiple' && renderOptions()}
      {q.type === 'judge' && renderJudge()}
      {q.type === 'fill' && renderFill()}
      {q.type === 'essay' && renderEssay()}
    </View>
  )
})
