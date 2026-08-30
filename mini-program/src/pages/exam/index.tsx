import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Button, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { ExamSession, AnswerMap, Question, Violation } from '@/types'
import { gradeQuestion, isObjective } from '@/types'
import { submitExamResult } from '@/lib/supabase'
import { getStudentInfo, saveLocalResult, saveReviewData } from '@/lib/store'
import QuestionRender from '@/components/QuestionRender'
import './index.css'

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function ExamPage() {
  const [session, setSession] = useState<ExamSession | null>(null)
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [startAt, setStartAt] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [violations, setViolations] = useState<Violation[]>([])
  const [submitting, setSubmitting] = useState(false)

  // 防作弊追踪
  const lastHideAt = useRef(0)
  const switchTimes = useRef<number[]>([])
  const questionStartAt = useRef(0)
  const questionTimes = useRef<Record<string, number>>({})
  const fastAnswerCount = useRef(0)

  useEffect(() => {
    const s = Taro.getStorageSync('current_session') as ExamSession | undefined
    if (!s) {
      Taro.redirectTo({ url: '/pages/index/index' })
      return
    }
    setSession(s)
    setStartAt(Date.now())
    setRemaining(s.minutes * 60)
    questionStartAt.current = Date.now()
  }, [])

  useEffect(() => {
    if (!session || remaining <= 0) return
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil(session.minutes * 60 - (Date.now() - startAt) / 1000))
      setRemaining(left)
      if (left <= 0) {
        clearInterval(timer)
        handleSubmit(true)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [session, startAt])

  // 记录当前题目耗时
  useEffect(() => {
    if (!currentQuestion) return
    const now = Date.now()
    if (questionStartAt.current > 0) {
      const prevId = session?.paper[currentIndex - 1]?.id
      if (prevId) {
        questionTimes.current[prevId] = now - questionStartAt.current
      }
    }
    questionStartAt.current = now
  }, [currentIndex, currentQuestion, session])

  // 切出/截屏检测
  useEffect(() => {
    const onHide = () => {
      const now = Date.now()
      lastHideAt.current = now
      switchTimes.current.push(now)

      // 检测快速切换（10秒内切出2次以上）
      const recent = switchTimes.current.filter((t) => now - t < 10000)
      if (recent.length >= 2) {
        setViolations((v) => [
          ...v,
          { type: 'rapid-switch', label: '短时间内频繁切出', time: now },
        ])
      }

      setViolations((v) => [
        ...v,
        { type: 'hidden', label: '切换离开小程序', time: now },
      ])
    }

    const onShow = () => {
      if (lastHideAt.current > 0) {
        const awayMs = Date.now() - lastHideAt.current
        const awaySec = Math.round(awayMs / 1000)

        // 离开超过 30 秒记录长时间离开
        if (awaySec > 30) {
          setViolations((v) => [
            ...v,
            { type: 'absence', label: `离开 ${awaySec} 秒`, time: Date.now(), meta: { awaySec } },
          ])
        }
      }
    }

    const onScreenshot = () => {
      setViolations((v) => [
        ...v,
        { type: 'copy', label: '截屏', time: Date.now() },
      ])
      Taro.showToast({ title: '检测到截屏，已记录违规', icon: 'none' })
    }

    Taro.eventCenter.on('appDidHide', onHide)
    Taro.eventCenter.on('appDidShow', onShow)
    Taro.onUserCaptureScreen(onScreenshot)

    return () => {
      Taro.eventCenter.off('appDidHide', onHide)
      Taro.eventCenter.off('appDidShow', onShow)
      Taro.offUserCaptureScreen(onScreenshot)
    }
  }, [])

  // 违规过多自动交卷
  useEffect(() => {
    if (violations.length >= 5 && !submitting) {
      Taro.showModal({
        title: '违规次数过多',
        content: '检测到多次违规操作，将强制交卷',
        showCancel: false,
        success: () => handleSubmit(true),
      })
    }
  }, [violations.length, submitting])

  const currentQuestion = useMemo<Question | undefined>(() => {
    return session?.paper[currentIndex]
  }, [session, currentIndex])

  const answeredCount = useMemo(() => {
    return session?.paper.filter((q) => {
      const a = answers[q.id]
      if (Array.isArray(a)) return a.length > 0
      return a !== undefined && a !== ''
    }).length ?? 0
  }, [answers, session])

  const handleAnswer = useCallback(
    (value: string | string[]) => {
      if (!currentQuestion) return

      // 检测答题过快（少于 1 秒，且连续 3 次才记录）
      const elapsed = Date.now() - questionStartAt.current
      if (elapsed < 1000) {
        fastAnswerCount.current += 1
        if (fastAnswerCount.current >= 3) {
          setViolations((v) => [
            ...v,
            { type: 'fast-answer', label: '连续多题答题过快', time: Date.now() },
          ])
          fastAnswerCount.current = 0
        }
      } else {
        fastAnswerCount.current = 0
      }

      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }))
    },
    [currentQuestion],
  )

  const handleSubmit = useCallback(
    async (forced = false) => {
      if (!session) return
      if (!forced) {
        const res = await Taro.showModal({
          title: '确认交卷',
          content: `已答 ${answeredCount}/${session.paper.length} 题，确定交卷？`,
        })
        if (!res.confirm) return
      }

      setSubmitting(true)
      const info = getStudentInfo()
      let correct = 0
      session.paper.forEach((q) => {
        if (isObjective(q) && gradeQuestion(q, answers[q.id])) {
          correct += 1
        }
      })

      // 记录最后一题耗时
      if (currentQuestion) {
        questionTimes.current[currentQuestion.id] = Date.now() - questionStartAt.current
      }

      const duration = Math.floor((Date.now() - startAt) / 1000)
      const result: Parameters<typeof saveLocalResult>[0] = {
        sessionCode: session.code,
        studentName: info.name,
        studentId: info.studentId,
        studentPhone: info.phone,
        total: session.paper.length,
        correct,
        duration,
        violations,
        finishedAt: Date.now(),
        answers,
      }
      saveLocalResult(result)
      saveReviewData({
        session,
        answers,
        correct,
        duration,
        violations: violations.length,
        finishedAt: Date.now(),
      })
      const ok = await submitExamResult(result, session.teacherId)
      setSubmitting(false)
      Taro.removeStorageSync('current_session')
      Taro.redirectTo({
        url: `/pages/result/index?total=${session.paper.length}&correct=${correct}&duration=${duration}&synced=${ok ? 1 : 0}`,
      })
    },
    [session, answeredCount, answers, startAt, violations, currentQuestion],
  )

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1))
  }, [])

  const goNext = useCallback(() => {
    if (!session) return
    setCurrentIndex((i) => Math.min(session.paper.length - 1, i + 1))
  }, [session])

  if (!session) return null

  const isLastQuestion = currentIndex === session.paper.length - 1

  return (
    <View className="exam-page">
      <View className="exam-header">
        <Text style={{ fontSize: '30rpx', fontWeight: '500' }}>{session.title}</Text>
        <View style={{ display: 'flex', alignItems: 'center', gap: '16rpx' }}>
          {violations.length > 0 && (
            <Text className="violation-badge">违规 {violations.length}</Text>
          )}
          <Text className={remaining < 60 ? 'time-danger' : 'time'}>{formatTime(remaining)}</Text>
        </View>
      </View>

      <ScrollView scrollY className="exam-scroll">
        <View className="container">
          {currentQuestion && (
            <QuestionRender
              question={currentQuestion}
              index={currentIndex}
              value={answers[currentQuestion.id]}
              onChange={handleAnswer}
            />
          )}
        </View>
      </ScrollView>

      <View className="exam-footer">
        <View className="progress-bar">
          <View className="progress-fill" style={{ width: `${((currentIndex + 1) / session.paper.length) * 100}%` }} />
        </View>
        <View className="footer-actions">
          <Button
            className="btn footer-btn"
            disabled={currentIndex === 0}
            onClick={goPrev}
          >
            上一题
          </Button>
          <Text className="text-muted" style={{ fontSize: '26rpx' }}>
            {currentIndex + 1}/{session.paper.length} 已答 {answeredCount}
          </Text>
          {isLastQuestion ? (
            <Button className="btn btn-danger footer-btn" loading={submitting} disabled={submitting} onClick={() => handleSubmit(false)}>
              交卷
            </Button>
          ) : (
            <Button className="btn btn-primary footer-btn" onClick={goNext}>
              下一题
            </Button>
          )}
        </View>
      </View>
    </View>
  )
}
