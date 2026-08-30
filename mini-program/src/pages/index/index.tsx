import { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { fetchSessionByCode } from '@/lib/supabase'
import { getStudentInfo, setStudentInfo } from '@/lib/store'
import './index.css'

export default function IndexPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState(getStudentInfo())

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) {
      Taro.showToast({ title: '请输入考试码', icon: 'none' })
      return
    }
    if (!info.name.trim() || !info.studentId.trim()) {
      Taro.showToast({ title: '请填写姓名和学号', icon: 'none' })
      return
    }
    setStudentInfo(info)
    setLoading(true)
    const session = await fetchSessionByCode(trimmed)
    setLoading(false)
    if (!session) {
      Taro.showToast({ title: '考试码不存在或已失效', icon: 'none' })
      return
    }
    if (!session.paper || session.paper.length === 0) {
      Taro.showToast({ title: '该考试没有题目', icon: 'none' })
      return
    }
    Taro.setStorageSync('current_session', session)
    Taro.navigateTo({ url: '/pages/exam/index' })
  }

  return (
    <View className="container">
      <View className="card text-center" style={{ marginTop: '60rpx' }}>
        <View style={{ textAlign: 'center' }}>
          <Text style={{ fontSize: '44rpx', fontWeight: '700' }}>题练通</Text>
        </View>
        <View style={{ textAlign: 'center', marginTop: '12rpx' }}>
          <Text className="text-muted">输入考试码，开始答题</Text>
        </View>
      </View>

      <View className="card mt-6">
        <Text style={{ fontSize: '30rpx', fontWeight: '500' }}>考试码</Text>
        <Input
          className="input mt-2"
          placeholder="例如 ABCD-1234"
          value={code}
          onInput={(e) => setCode(e.detail.value.toUpperCase())}
          maxlength={20}
        />

        <View style={{ marginTop: '32rpx' }}>
          <Text style={{ fontSize: '30rpx', fontWeight: '500' }}>考生信息</Text>
        </View>
        <Input
          className="input mt-2"
          placeholder="姓名"
          value={info.name}
          onInput={(e) => setInfo({ ...info, name: e.detail.value })}
        />
        <Input
          className="input mt-2"
          placeholder="学号"
          value={info.studentId}
          onInput={(e) => setInfo({ ...info, studentId: e.detail.value })}
        />
        <Input
          className="input mt-2"
          placeholder="手机号（选填）"
          type="number"
          value={info.phone}
          onInput={(e) => setInfo({ ...info, phone: e.detail.value })}
        />

        <Button
          className="btn btn-primary mt-6"
          loading={loading}
          disabled={loading}
          onClick={handleJoin}
        >
          进入考试
        </Button>
      </View>

      <View style={{ textAlign: 'center', marginTop: '40rpx' }}>
        <Text className="text-muted" style={{ fontSize: '26rpx' }}>
          老师请在网页端发起考试并获取考试码
        </Text>
      </View>
    </View>
  )
}
