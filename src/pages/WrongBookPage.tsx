import { useState } from 'react'
import { BookOpenCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { QuestionCard } from '@/components/QuestionCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useStore } from '@/lib/store'
import { gradeQuestion, type AnswerMap, type Question } from '@/types'

/** 错题本 / 收藏夹：支持重做（重做答对后自动移出错题本） */
function QuestionList({ list, emptyHint, onRemove, isWrongBook }: { list: Question[]; emptyHint: string; onRemove: (id: string) => void; isWrongBook?: boolean }) {
  const { setWrong, favoriteIds, toggleFavorite } = useStore()
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [judged, setJudged] = useState<Set<string>>(new Set())

  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
          <BookOpenCheck className="h-10 w-10" />
          <p className="text-sm">{emptyHint}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {list.map((q, i) => (
        <div key={q.id} className="space-y-2">
          <QuestionCard
            question={q}
            index={i}
            value={answers[q.id]}
            onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
            showResult={judged.has(q.id)}
            allowSelfMark
            isFavorite={favoriteIds.includes(q.id)}
            onToggleFavorite={() => toggleFavorite(q.id)}
          />
          <div className="flex justify-end gap-2">
            {!judged.has(q.id) ? (
              <Button
                size="sm"
                className="cursor-pointer"
                onClick={() => {
                  const ans = answers[q.id]
                  if (ans === undefined || ans === '' || (Array.isArray(ans) && ans.every((x) => !x.trim()))) {
                    toast.warning('请先作答')
                    return
                  }
                  const ok = gradeQuestion(q, ans)
                  setJudged((prev) => new Set(prev).add(q.id))
                  if (isWrongBook && ok) {
                    setWrong(q.id, false)
                    toast.success('重做正确，已移出错题本')
                  } else {
                    ok ? toast.success('回答正确') : toast.error('仍然答错，继续加油')
                  }
                }}
              >
                重做本题
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                  setJudged((prev) => {
                    const next = new Set(prev)
                    next.delete(q.id)
                    return next
                  })
                  setAnswers((prev) => ({ ...prev, [q.id]: undefined as unknown as string }))
                }}
              >
                再做一次
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="cursor-pointer text-muted-foreground hover:text-red-500"
              onClick={() => {
                onRemove(q.id)
                toast.success('已移除')
              }}
            >
              <Trash2 className="mr-1 h-4 w-4" /> 移除
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function WrongBookPage() {
  const { questions, wrongIds, favoriteIds, setWrong, toggleFavorite } = useStore()
  const wrongList = questions.filter((q) => wrongIds.includes(q.id))
  const favList = questions.filter((q) => favoriteIds.includes(q.id))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">错题与收藏</h1>
        <p className="text-sm text-muted-foreground">
          错题 {wrongIds.length} 道 · 收藏 {favoriteIds.length} 道；错题重做答对后自动移出。
        </p>
      </div>
      <Tabs defaultValue="wrong">
        <TabsList>
          <TabsTrigger value="wrong" className="cursor-pointer">错题本（{wrongList.length}）</TabsTrigger>
          <TabsTrigger value="fav" className="cursor-pointer">收藏夹（{favList.length}）</TabsTrigger>
        </TabsList>
        <TabsContent value="wrong" className="mt-4">
          <QuestionList list={wrongList} emptyHint="暂无错题，保持住！" onRemove={(id) => setWrong(id, false)} isWrongBook />
        </TabsContent>
        <TabsContent value="fav" className="mt-4">
          <QuestionList list={favList} emptyHint="还没有收藏题目，答题页右上角可收藏。" onRemove={toggleFavorite} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
