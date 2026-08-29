import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Loader2, Phone, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/auth'

const REMEMBER_KEY = 'ep_remember_id'
const SAVED_ID_KEY = 'ep_saved_id'

export function LoginPage() {
  const { signIn, signUp, user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(REMEMBER_KEY) === '1' ? localStorage.getItem(SAVED_ID_KEY) ?? '' : ''
    } catch {
      return ''
    }
  })
  const [remember, setRemember] = useState(() => {
    try {
      return localStorage.getItem(REMEMBER_KEY) === '1'
    } catch {
      return false
    }
  })
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // 已登录直接回首页
  if (user) {
    navigate('/', { replace: true })
    return null
  }

  const run = async (action: 'in' | 'up') => {
    if (!email.trim() && !mobile.trim()) {
      toast.warning('请输入邮箱或手机号')
      return
    }
    if (!password) {
      toast.warning('请输入密码')
      return
    }
    if (action === 'up') {
      if (!/^[一-龥A-Za-z][一-龥A-Za-z0-9_]{1,19}$/.test(name.trim())) {
        toast.warning('昵称需为 2~20 位中英文（可含数字、下划线），如：李明、Alice')
        return
      }
      if (password.length < 6) {
        toast.warning('密码至少 6 位')
        return
      }
      // 手机号注册：邮箱可留空；只用邮箱注册：手机号可留空；两者都填：手机号将作为登录账号
      if (!email.trim() && !/^\d{11}$/.test(mobile.trim())) {
        toast.warning('请填写 11 位手机号或邮箱')
        return
      }
    }
    setLoading(true)
    const err = action === 'in' ? await signIn(email.trim() || mobile.trim(), password) : await signUp(email.trim(), password, name.trim(), mobile.trim())
    setLoading(false)
    if (err) {
      toast.error(err.includes('Invalid login') ? '邮箱或密码不正确' : err)
    } else {
      // 记住账号（不保存密码，密码由登录后的会话保持）
      try {
        if (remember && action === 'in') {
          localStorage.setItem(REMEMBER_KEY, '1')
          localStorage.setItem(SAVED_ID_KEY, email.trim() || mobile.trim())
        } else if (action === 'in') {
          localStorage.removeItem(REMEMBER_KEY)
          localStorage.removeItem(SAVED_ID_KEY)
        }
      } catch { /* 存储不可用时忽略 */ }
      toast.success(action === 'in' ? '登录成功' : '注册成功！如开启邮箱验证，请先到邮箱确认')
      navigate('/', { replace: true })
    }
  }

  const form = (action: 'in' | 'up') => (
    <div className="space-y-4">
      {action === 'up' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="name-up">昵称（两个字的名字也可以）</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="name-up"
                className="pl-9"
                placeholder="如：李明 / Alice"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
                maxLength={20}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mobile-up">手机号（选填，无需验证）</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="mobile-up"
                className="pl-9"
                type="tel"
                inputMode="numeric"
                placeholder="如：13800000000"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 11))}
                autoComplete="tel"
                maxLength={11}
              />
            </div>
          </div>
        </>
      )}
      <div className="space-y-2">
        <Label htmlFor={`email-${action}`}>{action === 'in' ? '邮箱 / 手机号' : '邮箱（手机号注册可留空）'}</Label>
        <Input
          id={`email-${action}`}
          type={action === 'in' ? 'text' : 'email'}
          inputMode={action === 'in' ? 'email' : 'email'}
          placeholder={action === 'in' ? 'you@example.com 或 13800000000' : 'you@example.com（手机号注册可留空）'}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete={action === 'in' ? 'username' : 'email'}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`pwd-${action}`}>密码{action === 'up' && '（至少 6 位）'}</Label>
        <Input
          id={`pwd-${action}`}
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run(action)}
          autoComplete={action === 'in' ? 'current-password' : 'new-password'}
        />
      </div>
      {action === 'in' && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
          记住账号（下次自动填充，不保存密码）
        </label>
      )}
      <Button className="w-full cursor-pointer" disabled={loading} onClick={() => run(action)}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {action === 'in' ? '登录' : '注册'}
      </Button>
    </div>
  )

  return (
    <div className="relative flex min-h-[75vh] items-center justify-center overflow-hidden">
      {/* 装饰背景光斑 */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-cyan-300/30 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-8 h-40 w-40 -translate-x-1/2 rounded-full bg-violet-300/20 blur-3xl" />
      <Card className="relative w-full max-w-sm shadow-xl shadow-sky-100">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 text-white shadow-md shadow-sky-200">
            <GraduationCap className="h-6 w-6" />
          </div>
          <CardTitle>登录题练通</CardTitle>
          <CardDescription>登录后题库云端同步，换设备不丢数据</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="in">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="in" className="cursor-pointer">登录</TabsTrigger>
              <TabsTrigger value="up" className="cursor-pointer">注册</TabsTrigger>
            </TabsList>
            <TabsContent value="in" className="mt-4">{form('in')}</TabsContent>
            <TabsContent value="up" className="mt-4">{form('up')}</TabsContent>
          </Tabs>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            暂不登录也可以使用，数据仅保存在本机浏览器
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
