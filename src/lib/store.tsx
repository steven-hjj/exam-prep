import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { Bank, ExamRecord, Question, Subscription, UsageStats, PlanType } from '@/types'
import { genBankCode, PLAN_LIMITS } from '@/types'
import { DEMO_BANK, sampleQuestions } from '@/data/sampleQuestions'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

/** localStorage 持久化 Hook */
function usePersistentState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          /* 存储超限等情况静默失败 */
        }
        return next
      })
    },
    [key],
  )
  return [value, set]
}

interface AppStore {
  banks: Bank[]
  createBank: (name: string, subject?: string, grade?: string, description?: string, code?: string) => Bank
  deleteBank: (id: string) => void
  questions: Question[]
  bankQuestions: (bankId: string) => Question[]
  addQuestions: (qs: Question[]) => void
  removeQuestion: (id: string) => void
  wrongIds: string[]
  setWrong: (id: string, wrong: boolean) => void
  favoriteIds: string[]
  toggleFavorite: (id: string) => void
  records: ExamRecord[]
  addRecord: (r: ExamRecord) => void
  subscription: Subscription | null
  usageStats: UsageStats | null
  /** 当前用量与上限 */
  quota: {
    banksUsed: number
    banksLimit: number
    questionsUsed: number
    questionsLimit: number
    examsUsed: number
    examsLimit: number
    studentsUsed: number
    studentsLimit: number
    aiPagesUsed: number
    aiPagesLimit: number
  }
}

const StoreContext = createContext<AppStore | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [banks, setBanks] = usePersistentState<Bank[]>('ep_banks', [DEMO_BANK])
  const [questions, setQuestions] = usePersistentState<Question[]>('ep_questions_v2', sampleQuestions)
  const [wrongIds, setWrongIds] = usePersistentState<string[]>('ep_wrong', [])
  const [favoriteIds, setFavoriteIds] = usePersistentState<string[]>('ep_favorites', [])
  const [records, setRecords] = usePersistentState<ExamRecord[]>('ep_records', [])
  const [subscription, setSubscription] = usePersistentState<Subscription | null>('ep_subscription', null)
  const [usageStats, setUsageStats] = usePersistentState<UsageStats | null>('ep_usage_stats', null)
  const syncedRef = useRef<string | null>(null)

  /* ---------- 云端同步：登录后拉取；云端为空且本地有数据则首次迁移上传 ---------- */
  useEffect(() => {
    if (!supabase || !user || syncedRef.current === user.id) return
    const sb = supabase
    syncedRef.current = user.id

    // 规范化：早期本地数据可能使用非 UUID（如示例题库的 'bank-demo'），云端 banks.id 是 uuid 类型，必须先换 ID
    const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    const bankIdMap: Record<string, string> = {}
    let localBanks = banks
    let localQuestions = questions
    const needsNormalize = banks.some((b) => !isUuid(b.id))
    if (needsNormalize) {
      localBanks = banks.map((b) => {
        if (isUuid(b.id)) return b
        const newId = crypto.randomUUID()
        bankIdMap[b.id] = newId
        return { ...b, id: newId }
      })
      localQuestions = questions.map((q) => (bankIdMap[q.bankId] ? { ...q, bankId: bankIdMap[q.bankId] } : q))
      setBanks(localBanks)
      setQuestions(localQuestions)
      toast.info('已为本地示例题库生成新 ID，准备同步到云端', { duration: 3000 })
    }

    ;(async () => {
      const currentMonth = new Date().toISOString().slice(0, 7)
      const [{ data: cloudBanks, error: e1 }, { data: cloudQuestions, error: e2 }, { data: ud, error: e3 }, { data: sub, error: e4 }, { data: usage, error: e5 }] = await Promise.all([
        sb.from('banks').select('*'),
        sb.from('questions').select('*'),
        sb.from('user_data').select('*').maybeSingle(),
        sb.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
        sb.from('usage_stats').select('*').eq('user_id', user.id).eq('year_month', currentMonth).maybeSingle(),
      ])
      if (e1 || e2) {
        toast.warning('云端数据拉取失败（请确认已执行 schema.sql 建表），当前使用本地数据', { duration: 6000 })
        return
      }
      // 学习数据：云端有则以云端为准；没有则把本地推上去
      if (!e3) {
        if (ud) {
          setWrongIds(ud.wrong_ids ?? [])
          setFavoriteIds(ud.favorite_ids ?? [])
          setRecords((ud.records as ExamRecord[]) ?? [])
        } else {
          sb.from('user_data').upsert({ user_id: user.id, wrong_ids: wrongIds, favorite_ids: favoriteIds, records }).then(() => {})
        }
      }

      // 套餐与用量：没有则初始化免费版
      if (!e4) {
        if (sub) {
          setSubscription({
            userId: sub.user_id,
            plan: sub.plan as PlanType,
            expiresAt: sub.expires_at ? new Date(sub.expires_at).getTime() : undefined,
            maxBanks: sub.max_banks,
            maxQuestions: sub.max_questions,
            maxExamsMonthly: sub.max_exams_monthly,
            maxStudentsMonthly: sub.max_students_monthly,
            aiPagesMonthly: sub.ai_pages_monthly,
            createdAt: new Date(sub.created_at).getTime(),
            updatedAt: new Date(sub.updated_at).getTime(),
          })
        } else {
          const free = PLAN_LIMITS.free
          const newSub = {
            user_id: user.id,
            plan: 'free' as PlanType,
            max_banks: free.maxBanks,
            max_questions: free.maxQuestions,
            max_exams_monthly: free.maxExamsMonthly,
            max_students_monthly: free.maxStudentsMonthly,
            ai_pages_monthly: free.aiPagesMonthly,
          }
          sb.from('subscriptions').upsert(newSub).then(() => {})
          setSubscription({
            userId: user.id,
            plan: 'free',
            maxBanks: free.maxBanks,
            maxQuestions: free.maxQuestions,
            maxExamsMonthly: free.maxExamsMonthly,
            maxStudentsMonthly: free.maxStudentsMonthly,
            aiPagesMonthly: free.aiPagesMonthly,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })
        }
      }
      if (!e5) {
        if (usage) {
          setUsageStats({
            id: usage.id,
            userId: usage.user_id,
            yearMonth: usage.year_month,
            examsCreated: usage.exams_created,
            studentsReached: usage.students_reached,
            aiPagesUsed: usage.ai_pages_used,
          })
        } else {
          const newUsage = {
            user_id: user.id,
            year_month: currentMonth,
            exams_created: 0,
            students_reached: 0,
            ai_pages_used: 0,
          }
          sb.from('usage_stats').upsert(newUsage).then(() => {})
          setUsageStats({ userId: user.id, yearMonth: currentMonth, examsCreated: 0, studentsReached: 0, aiPagesUsed: 0 })
        }
      }

      if ((cloudBanks?.length ?? 0) === 0) {
        // 首次使用：把本地数据迁移到云端
        const bankRows = localBanks.map((b) => ({
          id: b.id, user_id: user.id, name: b.name, code: b.code || genBankCode(),
          subject: b.subject || '其他', grade: b.grade ?? '', description: b.description,
          created_at: new Date(b.createdAt).toISOString(),
        }))
        const questionRows = localQuestions.map((q) => ({
          id: q.id, bank_id: q.bankId, user_id: user.id, type: q.type, category: q.category,
          tags: q.tags, stem: q.stem, options: q.options ?? null, answer: q.answer, analysis: q.analysis ?? null,
          difficulty: q.difficulty ?? 3, source: q.source ?? '',
          created_at: new Date(q.createdAt).toISOString(),
        }))
        const { error: be } = await sb.from('banks').upsert(bankRows)
        const { error: qe } = questionRows.length ? await sb.from('questions').upsert(questionRows) : { error: null }
        if (be || qe) {
          toast.warning(
            `本地题库迁移到云端失败，数据仍保存在本机${be ? `（题库：${be.message}）` : ''}${qe ? `（题目：${qe.message}）` : ''}`,
            { duration: 8000 },
          )
        } else {
          toast.success('已将本地题库同步到云端')
        }
        return
      }

      // 关键兜底：云端题库壳上去了但题目没上去（如旧 check 约束缺少 type），自动补齐
      if ((cloudQuestions?.length ?? 0) === 0 && localQuestions.length > 0) {
        const questionRows = localQuestions.map((q) => ({
          id: q.id, bank_id: q.bankId, user_id: user.id, type: q.type, category: q.category,
          tags: q.tags, stem: q.stem, options: q.options ?? null, answer: q.answer, analysis: q.analysis ?? null,
          difficulty: q.difficulty ?? 3, source: q.source ?? '',
          created_at: new Date(q.createdAt).toISOString(),
        }))
        const { error: qe } = await sb.from('questions').upsert(questionRows)
        if (qe) {
          toast.warning(`题目补齐到云端失败：${qe.message}`, { duration: 8000 })
        } else {
          toast.success('已自动把本地题目补齐到云端')
          setQuestions(
            localQuestions.map((q) => ({ ...q })),
          )
          return
        }
      }

      // 云端为准（但题目为空时不要用空数组覆盖本地）
      setBanks(cloudBanks!.map((b) => ({
        id: b.id,
        code: b.code || 'BK-????',
        name: b.name,
        subject: b.subject || '其他',
        grade: b.grade || undefined,
        description: b.description ?? '',
        createdAt: new Date(b.created_at).getTime(),
      })))
      if ((cloudQuestions?.length ?? 0) > 0) {
        setQuestions(
          cloudQuestions!.map((q) => ({
            id: q.id, bankId: q.bank_id, type: q.type, category: q.category, tags: q.tags ?? [],
            stem: q.stem, options: q.options ?? undefined, answer: q.answer, analysis: q.analysis ?? undefined,
            difficulty: q.difficulty ?? 3, source: q.source ?? '',
            createdAt: new Date(q.created_at).getTime(),
          })),
        )
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  /* ---------- 学习数据（错题/收藏/记录）变更后防抖推送云端 ---------- */
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!supabase || !user || syncedRef.current !== user.id) return
    const sb = supabase
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => {
      sb
        .from('user_data')
        .upsert({ user_id: user.id, wrong_ids: wrongIds, favorite_ids: favoriteIds, records, updated_at: new Date().toISOString() })
        .then(() => {})
    }, 800)
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current)
    }
  }, [wrongIds, favoriteIds, records, user])

  /* ---------- 写操作：本地即时生效，云端异步跟随 ---------- */

  const createBank = useCallback(
    (name: string, subject = '其他', grade = '', description = '', code = '') => {
      const bank: Bank = {
        id: crypto.randomUUID(),
        code: code.trim() || genBankCode(),
        name,
        subject,
        grade: grade.trim() || undefined,
        description,
        createdAt: Date.now(),
      }
      setBanks((prev) => [bank, ...prev])
      if (supabase && user) {
        supabase
          .from('banks')
          .insert({ id: bank.id, user_id: user.id, name, code: bank.code, subject, grade: bank.grade ?? '', description })
          .then(({ error }) => {
            if (error) toast.warning('题库已保存到本机，云端同步失败')
          })
      }
      return bank
    },
    [setBanks, user],
  )

  const deleteBank = useCallback(
    (id: string) => {
      setBanks((prev) => prev.filter((b) => b.id !== id))
      setQuestions((prev) => prev.filter((q) => q.bankId !== id))
      if (supabase && user) supabase.from('banks').delete().eq('id', id).then(() => {})
    },
    [setBanks, setQuestions, user],
  )

  const addQuestions = useCallback(
    (qs: Question[]) => {
      setQuestions((prev) => [...qs, ...prev])
      if (supabase && user && qs.length) {
        const rows = qs.map((q) => ({
          id: q.id, bank_id: q.bankId, user_id: user.id, type: q.type, category: q.category,
          tags: q.tags, stem: q.stem, options: q.options ?? null, answer: q.answer, analysis: q.analysis ?? null,
          difficulty: q.difficulty ?? 3, source: q.source ?? '',
        }))
        supabase.from('questions').insert(rows).then(({ error }) => {
          if (error) toast.warning('题目已保存到本机，云端同步失败')
        })
      }
    },
    [setQuestions, user],
  )

  const removeQuestion = useCallback(
    (id: string) => {
      setQuestions((prev) => prev.filter((q) => q.id !== id))
      if (supabase && user) supabase.from('questions').delete().eq('id', id).then(() => {})
    },
    [setQuestions, user],
  )

  const bankQuestions = useCallback((bankId: string) => questions.filter((q) => q.bankId === bankId), [questions])

  const setWrong = useCallback(
    (id: string, wrong: boolean) =>
      setWrongIds((prev) => (wrong ? [...new Set([...prev, id])] : prev.filter((x) => x !== id))),
    [setWrongIds],
  )
  const toggleFavorite = useCallback(
    (id: string) =>
      setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [setFavoriteIds],
  )
  const addRecord = useCallback(
    (r: ExamRecord) => setRecords((prev) => [r, ...prev].slice(0, 100)),
    [setRecords],
  )

  const quota = useMemo(() => {
    const limit = subscription ?? PLAN_LIMITS.free
    return {
      banksUsed: banks.length,
      banksLimit: limit.maxBanks,
      questionsUsed: questions.length,
      questionsLimit: limit.maxQuestions,
      examsUsed: usageStats?.examsCreated ?? 0,
      examsLimit: limit.maxExamsMonthly,
      studentsUsed: usageStats?.studentsReached ?? 0,
      studentsLimit: limit.maxStudentsMonthly,
      aiPagesUsed: usageStats?.aiPagesUsed ?? 0,
      aiPagesLimit: limit.aiPagesMonthly,
    }
  }, [banks.length, questions.length, subscription, usageStats])

  const store = useMemo(
    () => ({
      banks, createBank, deleteBank, questions, bankQuestions, addQuestions, removeQuestion,
      wrongIds, setWrong, favoriteIds, toggleFavorite, records, addRecord,
      subscription, usageStats, quota,
    }),
    [banks, createBank, deleteBank, questions, bankQuestions, addQuestions, removeQuestion, wrongIds, setWrong, favoriteIds, toggleFavorite, records, addRecord, subscription, usageStats, quota],
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore(): AppStore {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within AppProvider')
  return ctx
}
