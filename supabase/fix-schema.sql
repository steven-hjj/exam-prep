-- 一键修复 ExamPrep 数据库 schema 兼容问题（幂等可重复执行）
-- 在 Supabase Dashboard → SQL Editor 粘贴后 Run

-- 1) banks 表补 code/subject/grade 列（迁移要求）
alter table banks add column if not exists code text;
alter table banks add column if not exists subject text default '其他';
alter table banks add column if not exists grade text default '';
create index if not exists idx_banks_code on banks(user_id, code);

-- 2) questions 表 type 约束支持 'essay'（示例题库含大题）
alter table questions drop constraint if exists questions_type_check;
alter table questions add constraint questions_type_check check (type in ('single','multiple','judge','fill','essay'));

-- 3) questions 表新增难度与来源字段
alter table questions add column if not exists difficulty int default 3 check (difficulty between 1 and 5);
alter table questions add column if not exists source text default '';
create index if not exists idx_questions_category on questions(user_id, category);
create index if not exists idx_questions_tags on questions using gin(tags);

-- 4) 新增订阅套餐与用量统计表
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
  year_month text not null,
  exams_created int not null default 0,
  students_reached int not null default 0,
  ai_pages_used int not null default 0,
  unique(user_id, year_month)
);

create index if not exists idx_usage_stats_user_month on usage_stats(user_id, year_month);

alter table subscriptions enable row level security;
alter table usage_stats enable row level security;

-- 5) RLS 策略（若已存在会报错可忽略）
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'banks' and policyname = 'banks_owner_all') then
    create policy "banks_owner_all" on banks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'questions' and policyname = 'questions_owner_all') then
    create policy "questions_owner_all" on questions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'subscriptions' and policyname = 'subscriptions_owner_all') then
    create policy "subscriptions_owner_all" on subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'usage_stats' and policyname = 'usage_stats_owner_all') then
    create policy "usage_stats_owner_all" on usage_stats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
