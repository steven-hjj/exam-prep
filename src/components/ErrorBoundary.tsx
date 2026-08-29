import { Component, type ReactNode } from 'react'
import { CloudCog, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
  message: string
}

/** 全局异常兜底：任何页面渲染错误都不白屏，给出重载入口 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) }
  }

  componentDidCatch(err: unknown) {
    console.error('[ErrorBoundary]', err)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <CloudCog className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="text-lg font-semibold">页面出了点小状况</p>
              <p className="mt-1 text-sm text-muted-foreground">
                你的数据都保存在本地/云端，不会丢失。刷新一下即可恢复。
              </p>
              {this.state.message && (
                <p className="mt-2 rounded bg-muted px-3 py-1.5 font-mono text-xs text-muted-foreground">
                  {this.state.message.slice(0, 120)}
                </p>
              )}
            </div>
            <Button className="cursor-pointer" onClick={() => window.location.reload()}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> 刷新页面
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
}
