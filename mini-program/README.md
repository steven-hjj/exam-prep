# 题练通小程序（学生端）

这是「题练通 ExamPrep」的微信小程序学生端，只做一件事：**输入考试码 → 做题 → 交卷**。

老师发题、组卷、看成绩仍然使用网页端：
https://steven-hjj.github.io/exam-prep

## 功能

- 输入考试码加入考试
- 填写姓名、学号、手机号（选填）
- 单选 / 多选 / 判断 / 填空 / 解答 全题型作答
- 倒计时自动交卷
- 切出小程序会记录违规
- 交卷后显示分数
- 成绩自动同步到 Supabase（联网时）

## 技术栈

- Taro 4 + React + TypeScript
- 共用网页端 Supabase 后端
- 同一套题目类型定义（`src/types/index.ts`）

## 本地开发

```bash
cd mini-program
npm install
npm run dev:weapp
```

然后用微信开发者工具打开 `mini-program/dist` 目录。

## 构建生产包

```bash
npm run build:weapp
```

构建产物在 `dist/`，用微信开发者工具上传即可。

## 环境变量

小程序不像网页那样能读 `.env`，所以 Supabase 配置目前写死在 `src/lib/supabase.ts` 顶部常量里。后续如需多环境，可在 `config/index.js` 的 `defineConstants` 中注入。

## 发布配置

- **AppID**: `wx90d7339d3b4493e1`
- **服务器域名**（微信公众平台后台配置）：
  - request 合法域名：`https://eavkjpsqxgrcjcfrhodx.supabase.co`
  - uploadFile 合法域名：`https://eavkjpsqxgrcjcfrhodx.supabase.co`
  - downloadFile 合法域名：`https://eavkjpsqxgrcjcfrhodx.supabase.co`

## 微信一键登录（可选）

当前版本不强制登录。后续如需微信一键登录，需要：

1. 在微信公众平台拿到 AppSecret
2. 在 Supabase 新增 Edge Function `wechat-login`
3. 小程序调用 `wx.login()` 拿到 code，发给 Edge Function 换取 openid
4. Edge Function 返回自定义 token 或绑定到已有账号

## 目录

```
src/
  app.ts / app.config.ts / app.css   # 小程序入口
  pages/
    index/   # 输入考试码和考生信息
    exam/    # 考试页面
    result/  # 结果页面
  lib/
    supabase.ts  # Supabase 客户端 + 考试码查询/交卷 API
    store.ts     # 本地成绩缓存 + 考生信息缓存
  components/
    QuestionRender.tsx  # 题目渲染组件
  types/
    index.ts   # 与网页端一致的数据类型
```
