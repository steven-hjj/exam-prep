/// <reference types="@tarojs/taro" />

declare module '*.png'
declare module '*.jpg'
declare module '*.jpeg'
declare module '*.gif'
declare module '*.svg'
declare module '*.css'
declare module '*.scss'
declare module '*.less'

declare const process: {
  env: {
    NODE_ENV: 'development' | 'production'
    SUPABASE_URL?: string
    SUPABASE_ANON_KEY?: string
    TARO_ENV: 'weapp' | 'swan' | 'alipay' | 'h5' | 'rn' | 'tt' | 'qq' | 'jd'
    [key: string]: string | undefined
  }
}
