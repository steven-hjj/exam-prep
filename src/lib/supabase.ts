import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** 云端是否已配置（缺 URL 或 anon key 时整站自动降级为本地模式） */
export const cloudEnabled = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = cloudEnabled ? createClient(url!, anonKey!) : null
