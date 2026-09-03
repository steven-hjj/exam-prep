-- 题练通 ExamPrep · Supabase 数据库结构
-- 使用方法：Supabase 控制台 → SQL Editor → 粘贴本文件全部内容 → Run
-- 只会执行一次；已开启行级安全（RLS），每个用户只能读写自己的数据

-- 题库表
create table if not exists banks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text default '',
  created_at timestamptz not null default now()
);

-- 题库编码与科目分类（可重复执行）
alter table banks add column if not exists code text;
alter table banks add column if not exists subject text default '其他';
alter table banks add column if not exists grade text default '';
create index if not exists idx_banks_code on banks(user_id, code);

-- 题目表
create table if not exists questions (
  id text primary key,
  bank_id uuid not null references banks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('single','multiple','judge','fill','essay')),
  category text not null default '未分类',
  tags text[] not null default '{}',
  stem text not null,
  options text[],
  answer jsonb not null,
  analysis text,
  created_at timestamptz not null default now()
);

-- 兼容旧版：旧 schema 的 type 约束不含 'essay'，需要更新
alter table questions drop constraint if exists questions_type_check;
alter table questions add constraint questions_type_check check (type in ('single','multiple','judge','fill','essay'));

-- v1.0 新增：题目难度与来源，支持 AI 自动分类与统计
alter table questions add column if not exists difficulty int default 3 check (difficulty between 1 and 5);
alter table questions add column if not exists source text default '';
create index if not exists idx_questions_category on questions(user_id, category);
create index if not exists idx_questions_tags on questions using gin(tags);

create index if not exists idx_questions_bank on questions(bank_id);
create index if not exists idx_questions_user on questions(user_id);

-- 行级安全
alter table banks enable row level security;
alter table questions enable row level security;

create policy "banks_owner_all" on banks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "questions_owner_all" on questions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 用户学习数据（错题 / 收藏 / 成绩记录），随账号云同步
create table if not exists user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wrong_ids text[] not null default '{}',
  favorite_ids text[] not null default '{}',
  records jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table user_data enable row level security;

create policy "user_data_owner_all" on user_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- v0.8 新增：老师发起考试 + 学生扫码参考
-- ============================================================

-- 考试场次（老师创建；paper 为试卷快照，学生凭 code 匿名读取）
create table if not exists exam_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '模拟考试',
  minutes int not null default 15,
  fullscreen boolean not null default true,
  paper jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_exam_sessions_code on exam_sessions(code);

-- 学生成绩（匿名插入；仅老师本人可查）
create table if not exists exam_results (
  id uuid primary key default gen_random_uuid(),
  session_code text not null references exam_sessions(code) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_name text not null,
  student_id text not null default '',
  student_phone text default '',
  total int not null,
  correct int not null,
  duration int not null default 0,
  violations jsonb not null default '[]'::jsonb,
  finished_at timestamptz not null default now()
);

-- v0.9：已建表的老库补列（重复执行安全）
alter table exam_results add column if not exists student_id text not null default '';
alter table exam_results add column if not exists student_phone text default '';
alter table exam_results add column if not exists answers jsonb;

-- 防止学生因网络超时重复提交：用客户端生成的 submission_id 做唯一约束
alter table exam_results add column if not exists submission_id text;
alter table exam_results drop constraint if exists exam_results_submission_id_key;
alter table exam_results add constraint exam_results_submission_id_key unique (submission_id);

create index if not exists idx_exam_results_session on exam_results(session_code);

alter table exam_sessions enable row level security;
alter table exam_results enable row level security;

-- 场次：老师全权管理；任何人凭 code 可读（学生扫码进考）
create policy "sessions_teacher_all" on exam_sessions
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);
create policy "sessions_public_read" on exam_sessions
  for select using (true);

-- 成绩：任何人可提交（学生匿名交卷）；仅老师本人可查
create policy "results_public_insert" on exam_results
  for insert with check (true);
create policy "results_teacher_read" on exam_results
  for select using (auth.uid() = teacher_id);

-- ============================================================
-- v1.0 新增：订阅套餐与用量统计（先展示上限，暂不含支付）
-- ============================================================

create table if not exists subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','teacher','school')),
  expires_at timestamptz,
  max_banks int not null default 3,
  max_questions int not null default 100,
  max_exams_monthly int not null default 10,
  max_students_monthly int not null default 100,
  ai_pages_monthly int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists usage_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year_month text not null, -- e.g. '2026-08'
  exams_created int not null default 0,
  students_reached int not null default 0,
  ai_pages_used int not null default 0,
  unique(user_id, year_month)
);

create index if not exists idx_usage_stats_user_month on usage_stats(user_id, year_month);

alter table subscriptions enable row level security;
alter table usage_stats enable row level security;

create policy "subscriptions_owner_all" on subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "usage_stats_owner_all" on usage_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
