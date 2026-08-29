import { useState, type ReactNode } from 'react'
import { LayoutGrid, NotebookPen, Send, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SideToolPanelProps {
  mode: 'practice' | 'exam'
  /** 剩余时间文本（考试模式），如 "45:00" */
  timeLeft?: string
  /** 时间告急（<5min）变红 */
  timeUrgent?: boolean
  /** 违规次数（考试模式） */
  violationCount?: number
  /** 答题卡节点（注入到抽屉中） */
  answerSheet: ReactNode
  onSubmit?: () => void
  submitLabel?: string
}

function ToolButton({ label, children, onClick, danger }: { label: string; children: ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          aria-label={label}
          className={cn('h-11 w-11 cursor-pointer rounded-xl', danger && 'text-red-500 hover:text-red-600')}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * 答题页侧边快捷工具面板：
 * 桌面端为右侧悬浮竖排工具栏（答题卡 / 草稿纸 / 计时 / 交卷）；
 * 移动端折叠为底部居中悬浮横条。抽屉内容全局只渲染一份。
 */
export function SideToolPanel({ mode, timeLeft, timeUrgent, violationCount, answerSheet, onSubmit, submitLabel = '交卷' }: SideToolPanelProps) {
  const [draftOpen, setDraftOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const buttons = (
    <>
      <ToolButton label="答题卡" onClick={() => setSheetOpen(true)}>
        <LayoutGrid className="h-5 w-5" />
      </ToolButton>
      <ToolButton label="草稿纸" onClick={() => setDraftOpen(true)}>
        <NotebookPen className="h-5 w-5" />
      </ToolButton>

      {/* 计时 / 违规（考试模式） */}
      {mode === 'exam' && (
        <div
          className={cn(
            'flex w-11 flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-xs font-semibold',
            timeUrgent ? 'border-red-300 text-red-500' : 'text-muted-foreground',
          )}
          title="剩余时间"
        >
          <Timer className="h-4 w-4" />
          {timeLeft}
          {(violationCount ?? 0) > 0 && <span className="mt-1 rounded bg-red-100 px-1 text-red-600">警 {violationCount}</span>}
        </div>
      )}

      {onSubmit && (
        <ToolButton label={submitLabel} danger onClick={onSubmit}>
          <Send className="h-5 w-5" />
        </ToolButton>
      )}
    </>
  )

  return (
    <TooltipProvider delayDuration={200}>
      {/* 桌面端：右侧悬浮竖排 */}
      <div className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 lg:block">
        <div className="flex flex-col items-center gap-1.5 rounded-2xl border bg-card/95 p-1.5 shadow-lg backdrop-blur">
          {buttons}
        </div>
      </div>
      {/* 移动端：底部居中悬浮横排 */}
      <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 lg:hidden">
        <div className="flex flex-row items-center gap-1.5 rounded-2xl border bg-card/95 p-1.5 shadow-lg backdrop-blur">
          {buttons}
        </div>
      </div>

      {/* 答题卡抽屉 */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-80">
          <SheetHeader>
            <SheetTitle>答题卡</SheetTitle>
          </SheetHeader>
          <div className="mt-4" onClick={() => setSheetOpen(false)}>
            {answerSheet}
          </div>
        </SheetContent>
      </Sheet>

      {/* 草稿纸抽屉 */}
      <Sheet open={draftOpen} onOpenChange={setDraftOpen}>
        <SheetContent side="right" className="w-96">
          <SheetHeader>
            <SheetTitle>草稿纸</SheetTitle>
          </SheetHeader>
          <Textarea className="mt-4 h-[70vh] resize-none" placeholder="在这里演算、记录思路……（仅本地临时保存）" />
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  )
}
