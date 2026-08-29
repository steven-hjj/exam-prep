import { useCallback, useEffect, useRef, useState } from 'react'
import type { Violation } from '@/types'

interface AntiCheatOptions {
  /** 是否启用（考试进行中才启用） */
  enabled: boolean
  /** 是否监听全屏退出（全屏考试模式，Esc 退出全屏记为严重违规） */
  fullscreen?: boolean
  /** 严重违规（切出/失焦/退出全屏）达到此次数后触发强制交卷，默认 3 */
  maxSeriousViolations?: number
  /** 每次违规回调（用于 toast 警告） */
  onViolation?: (v: Violation, seriousCount: number) => void
  /** 超过阈值回调（强制交卷） */
  onForceSubmit?: (violations: Violation[]) => void
}

const SERIOUS_TYPES = new Set<Violation['type']>(['blur', 'hidden', 'fullscreen-exit', 'navigation'])

/**
 * 考试防作弊 Hook（前端可落地的部分）：
 * - visibilitychange：页面切出/最小化 → 严重违规
 * - window blur：窗口失焦（切到其他应用）→ 严重违规
 * - copy / cut / contextmenu：禁用复制与右键 → 轻度违规
 * - keydown：拦截 PrintScreen（并清空剪贴板）、F12、Ctrl+P、Ctrl+Shift+I/J、Ctrl+S、Ctrl+U → 轻度违规
 * - beforeunload：异常关闭/刷新前弹出挽留提示
 *
 * 注意：Web 平台无法阻止操作系统级截屏（如 Win+Shift+S、手机物理按键），
 * 业界通用缓解方案是 PrintScreen 检测 + 剪贴板清空 + 失焦/切出记录审计。
 * 更强的约束需要客户端壳（Electron / 小程序）或人工监考配合。
 */
export function useAntiCheat({ enabled, fullscreen = false, maxSeriousViolations = 3, onViolation, onForceSubmit }: AntiCheatOptions) {
  const [violations, setViolations] = useState<Violation[]>([])
  const violationsRef = useRef<Violation[]>([])
  const onViolationRef = useRef(onViolation)
  const onForceSubmitRef = useRef(onForceSubmit)
  onViolationRef.current = onViolation
  onForceSubmitRef.current = onForceSubmit

  const push = useCallback(
    (v: Violation) => {
      violationsRef.current = [...violationsRef.current, v]
      setViolations(violationsRef.current)
      const seriousCount = violationsRef.current.filter((x) => SERIOUS_TYPES.has(x.type)).length
      onViolationRef.current?.(v, seriousCount)
      if (seriousCount >= maxSeriousViolations) {
        onForceSubmitRef.current?.(violationsRef.current)
      }
    },
    [maxSeriousViolations],
  )

  useEffect(() => {
    if (!enabled) return

    const make = (type: Violation['type'], label: string): Violation => ({ type, label, time: Date.now() })

    // 页面刚挂载/请求全屏的前 1.2 秒内，浏览器常会触发一次性的 blur/hidden，忽略这段时间避免误报
    const mountTs = Date.now()
    const isWarmup = () => Date.now() - mountTs < 1200

    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && !isWarmup()) {
        push(make('hidden', '页面切出（切换标签页或最小化）'))
      }
    }
    const onBlur = () => {
      if (!isWarmup()) push(make('blur', '窗口失焦（可能切换到其他应用）'))
    }
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      push(make('copy', '尝试复制内容'))
    }
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      push(make('contextmenu', '尝试打开右键菜单'))
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const blocked =
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && ['p', 's', 'u'].includes(e.key.toLowerCase())) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))
      if (blocked) {
        e.preventDefault()
        push(make('shortcut', `拦截快捷键：${e.key}`))
      }
    }
    // PrintScreen 在 keyup 才能稳定捕获；捕获后清空剪贴板，降低截图问 AI 的风险
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        navigator.clipboard?.writeText('').catch(() => {})
        push(make('shortcut', '检测到 PrintScreen 截屏，已清空剪贴板'))
      }
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    // 全屏考试：必须曾经进入过全屏，再退出才算违规；避免从未进入全屏就误报
    let hasEnteredFullscreen = false
    const onFullscreenChange = () => {
      if (document.fullscreenElement) {
        hasEnteredFullscreen = true
      } else if (hasEnteredFullscreen && !isWarmup()) {
        push(make('fullscreen-exit', '退出全屏考试模式'))
      }
    }
    // 拦截浏览器返回键：压入守卫历史记录，返回时记违规并重新压栈
    history.pushState({ examGuard: true }, '')
    const onPopState = () => {
      push(make('navigation', '尝试使用返回键离开考试'))
      history.pushState({ examGuard: true }, '')
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCopy)
    document.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('popstate', onPopState)
    if (fullscreen) document.addEventListener('fullscreenchange', onFullscreenChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('cut', onCopy)
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('popstate', onPopState)
      if (fullscreen) document.removeEventListener('fullscreenchange', onFullscreenChange)
      // 考试正常结束后清掉守卫历史记录，返回键恢复正常
      if (window.history.state?.examGuard) history.back()
    }
  }, [enabled, fullscreen, push])

  const reset = useCallback(() => {
    violationsRef.current = []
    setViolations([])
  }, [])

  /** 恢复历史违规记录（用于中断后恢复考试） */
  const restore = useCallback((vs: Violation[]) => {
    violationsRef.current = vs
    setViolations(vs)
  }, [])

  return { violations, seriousCount: violations.filter((v) => SERIOUS_TYPES.has(v.type)).length, reset, restore }
}
