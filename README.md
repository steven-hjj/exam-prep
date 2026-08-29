# 题练通 ExamPrep

教师端网页上传试卷 → AI 自动识别题目 → 一键发布考试 → 学生扫码/输入考试码参加考试 → 成绩与违规记录实时回传。

## 在线地址

- GitHub Pages（固定地址）：`https://cdredfox.github.io/exam-prep`
- 备用 CloudStudio：`https://58294f35c5224d61bf8914a6356c8d81.app.workbuddy.link`

## 技术栈

- React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- Supabase（Auth + PostgreSQL + Edge Functions）
- AI 识别通过 Supabase Edge Function 调用 OpenAI 兼容接口

## 环境变量

项目根目录创建 `.env`（已加入 `.gitignore`，不会提交）：

```env
VITE_SUPABASE_URL=https://你的项目.supabase.co
VITE_SUPABASE_ANON_KEY=你的anon_key
```

### GitHub Actions 部署用的 Secrets

推送到 GitHub 后，为了让 GitHub Pages 构建时也能拿到 Supabase 配置，需要在仓库里设置 Secrets：

1. 打开 GitHub 仓库 → **Settings → Secrets and variables → Actions**
2. 点击 **New repository secret**，分别添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. 数值和本地 `.env` 里的一致即可。

这样 `.env` 不用上传仓库，线上构建也能自动注入。

## 本地开发

```bash
npm install
npm run dev
```

## 部署

推送到 GitHub 仓库 `main` 分支后，GitHub Actions 会自动构建并部署到 GitHub Pages。

### 首次启用 GitHub Pages

1. 在 GitHub 仓库 → Settings → Pages
2. Source 选择 **GitHub Actions**

### 首次推送

```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/cdredfox/exam-prep.git
git push -u origin main
```

## Supabase 更新

数据库结构变更时，在 Supabase Dashboard → SQL Editor 执行 `supabase/fix-schema.sql`。

Edge Function 更新时，把 `supabase/functions/ai-extract/index.ts` 粘贴到 Supabase Dashboard → Edge Functions → Deploy。
