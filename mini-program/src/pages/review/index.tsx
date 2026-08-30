import { useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Question } from '@/types'
import { gradeQuestion, isObjective, TYPE_LABEL } from '@/types'
import { getReviewData, clearReviewData } from '@/lib/store'
import MathText from '@/components/MathText'
import './index.css'

export default function ReviewPage() {
  const reviewData = useMemo(() => getReviewData(), [])

  if (!reviewData) {
    Taro.showToast({ title: '没有可查看的解析', icon: 'none' })
    setTimeout(() => Taro.reLaunch({ url: '/pages/index/index' }), 1000)
    return null
  }

  const { session, answers, correct, duration, violations, finishedAt } = reviewData
  const paper = session.paper

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}分${s}秒`
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const getAnswerText = (q: Question): string => {
    if (q.type === 'single' || q.type === 'judge') {
      return String(q.answer)
    }
    if (q.type === 'multiple') {
      return (q.answer as string[]).sort().join(', ')
    }
    if (q.type === 'fill') {
      return (q.answer as string[]).join('；')
    }
    return String(q.answer)
  }

  const getUserAnswerText = (q: Question): string => {
    const userAnswer = answers[q.id]
    if (userAnswer === undefined || userAnswer === '') return '未作答'
    if (Array.isArray(userAnswer)) return userAnswer.join('；')
    return String(userAnswer)
  }

  return (
    <View className="review-page">
      <View className="review-header">
        <Text style={{ fontSize: '32rpx', fontWeight: '600' }}>{session.title}</Text>
        <Text className="text-muted" style={{ fontSize: '26rpx', marginTop: '8rpx' }}>
          得分 {correct}/{paper.length} · 用时 {formatDuration(duration)} · {formatDate(finishedAt)}
        </Text>
        {violations > 0 && (
          <Text style={{ fontSize: '26rpx', color: '#ef4444', marginTop: '4rpx' }}>
            违规 {violations} 次
          </Text>
        )}
      </View>

      <ScrollView scrollY className="review-scroll">
        <View className="container">
          {paper.map((q, i) => {
            const userAnswer = answers[q.id]
            const isCorrect = isObjective(q) && gradeQuestion(q, userAnswer)
            const isAnswered = userAnswer !== undefined && userAnswer !== ''

            return (
              <View key={q.id} className={`review-card ${isCorrect ? 'review-card-correct' : isAnswered ? 'review-card-wrong' : 'review-card-unanswered'}`}>
                <View className="review-card-header">
                  <Text className="review-card-index">第 {i + 1} 题</Text>
                  <Text className="review-card-type">{TYPE_LABEL[q.type]}</Text>
                  <Text className={`review-card-status ${isCorrect ? 'status-correct' : isAnswered ? 'status-wrong' : 'status-unanswered'}`}>
                    {isCorrect ? '✓ 正确' : isAnswered ? '✗ 错误' : '未作答'}
                  </Text>
                </View>

                <View className="review-card-body">
                  <MathText text={q.stem} fontSize="30rpx" />
                </View>

                <View className="review-card-answer">
                  <Text className="answer-label">你的答案：</Text>
                  <Text className="answer-value">{getUserAnswerText(q)}</Text>
                </View>

                <View className="review-card-answer">
                  <Text className="answer-label">正确答案：</Text>
                  <Text className="answer-value correct-answer">{getAnswerText(q)}</Text>
                </View>

                {q.analysis && (
                  <View className="review-card-analysis">
                    <Text className="analysis-label">解析：</Text>
                    <Text className="analysis-content">{q.analysis}</Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>
      </ScrollView>

      <View className="review-footer">
        <View className="btn btn-primary" onClick={() => {
          clearReviewData()
          Taro.reLaunch({ url: '/pages/index/index' })
        }}>
          返回首页
        </View>
      </View>
    </View>
  )
}
