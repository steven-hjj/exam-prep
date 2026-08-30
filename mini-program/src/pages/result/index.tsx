import { View, Text, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import './index.css'

export default function ResultPage() {
  const [data, setData] = useState({ total: 0, correct: 0, duration: 0, synced: 0 })

  useLoad((query) => {
    setData({
      total: Number(query.total) || 0,
      correct: Number(query.correct) || 0,
      duration: Number(query.duration) || 0,
      synced: Number(query.synced) || 0,
    })
  })

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}分${s}秒`
  }

  return (
    <View className="container">
      <View className="card text-center" style={{ marginTop: '80rpx' }}>
        <Text style={{ fontSize: '36rpx', fontWeight: '600' }}>考试完成</Text>
        <View className="score-circle mt-4">
          <Text style={{ fontSize: '72rpx', fontWeight: '700', color: '#3b82f6' }}>
            {data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0}
          </Text>
          <Text style={{ fontSize: '28rpx', color: '#6b7280' }}>分</Text>
        </View>
        <View className="mt-2" style={{ textAlign: 'center' }}>
          <Text className="text-muted">
            答对 {data.correct}/{data.total} 题 · 用时 {formatDuration(data.duration)}
          </Text>
        </View>
        {data.synced === 0 && (
          <View style={{ textAlign: 'center', marginTop: '8rpx' }}>
            <Text className="text-muted" style={{ fontSize: '26rpx', color: '#ef4444' }}>
              成绩暂存在本地，联网后会自动同步
            </Text>
          </View>
        )}
      </View>

      <Button className="btn btn-primary mt-6" onClick={() => Taro.navigateTo({ url: '/pages/review/index' })}>
        查看解析
      </Button>

      <Button className="btn mt-4" onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}>
        返回首页
      </Button>
    </View>
  )
}
