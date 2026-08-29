import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/lib/auth'
import { AppProvider } from '@/lib/store'
import { Skeleton } from '@/components/ui/skeleton'

/* 页面按需加载：首屏只下载必要代码，打开更快 */
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const BankManagePage = lazy(() => import('@/pages/BankManagePage').then((m) => ({ default: m.BankManagePage })))
const PracticePage = lazy(() => import('@/pages/PracticePage').then((m) => ({ default: m.PracticePage })))
const ExamPage = lazy(() => import('@/pages/ExamPage').then((m) => ({ default: m.ExamPage })))
const WrongBookPage = lazy(() => import('@/pages/WrongBookPage').then((m) => ({ default: m.WrongBookPage })))
const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const TeacherExamPage = lazy(() => import('@/pages/TeacherExamPage').then((m) => ({ default: m.TeacherExamPage })))
const ComposeExamPage = lazy(() => import('@/pages/ComposeExamPage').then((m) => ({ default: m.ComposeExamPage })))
const JoinExamPage = lazy(() => import('@/pages/JoinExamPage').then((m) => ({ default: m.JoinExamPage })))

function PageFallback() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <HashRouter>
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                {/* 学生扫码参考：独立全屏页，不带应用导航 */}
                <Route path="join/:code" element={<JoinExamPage />} />
                <Route element={<AppLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="bank" element={<BankManagePage />} />
                  <Route path="practice" element={<PracticePage />} />
                  <Route path="exam" element={<ExamPage />} />
                  <Route path="conduct" element={<TeacherExamPage />} />
                  <Route path="compose" element={<ComposeExamPage />} />
                  <Route path="wrongbook" element={<WrongBookPage />} />
                  <Route path="login" element={<LoginPage />} />
                </Route>
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </HashRouter>
      </AppProvider>
    </AuthProvider>
  )
}

export default App
