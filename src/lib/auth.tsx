import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { cloudEnabled, supabase } from '@/lib/supabase'

interface AuthState {
  /** 云端是否已配置 */
  cloudEnabled: boolean
  /** 是否正在初始化会话 */
  loading: boolean
  user: User | null
  /** 本地体验模式（未配置云端或用户选择跳过登录） */
  isGuest: boolean
  signUp: (email: string, password: string, displayName: string, mobile?: string) => Promise<string | null>
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(cloudEnabled)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const signUp = useCallback(async (email: string, password: string, displayName: string, mobile?: string) => {
    if (!supabase) return '云端未配置'
    // 手机号注册：自动生成虚拟邮箱作为登录 ID
    let realEmail = email.trim()
    if (!realEmail && mobile?.trim()) {
      realEmail = `${mobile.trim()}@phone.local`
    }
    if (!realEmail) return '请填写邮箱或手机号'
    const { error } = await supabase.auth.signUp({
      email: realEmail,
      password,
      options: {
        data: {
          display_name: displayName,
          mobile: mobile?.trim() || '',
        },
      },
    })
    return error?.message ?? null
  }, [])

  const signIn = useCallback(async (id: string, password: string) => {
    if (!supabase) return '云端未配置'
    // 输入不含 @ 时按手机号处理，自动转虚拟邮箱
    const email = /^\d{6,}$/.test(id) ? `${id}@phone.local` : id
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }, [])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      cloudEnabled,
      loading,
      user: session?.user ?? null,
      isGuest: !session?.user,
      signUp,
      signIn,
      signOut,
    }),
    [loading, session, signUp, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
