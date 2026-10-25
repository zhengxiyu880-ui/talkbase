-- talkbase · Postgres / Supabase 表结构
--
-- 现在项目用的是 data/db.json（零依赖、clone 就能跑）。
-- 要上生产、或者需要多人协作时：
--   1. 在 Supabase 里执行这个文件
--   2. 实现 src/lib/store.ts 里的 5 个函数（listSessions / getSession /
--      createSession / saveSummary / deleteSession），把 JSON 操作换成 SQL
--   3. 其余 API 路由、检索、UI 一行都不用改
--
-- 检索升级成向量检索时，把 segments.embedding 填上 pgvector，把
-- src/lib/retrieval.ts 的 retrieve() 换成向量相似度查询即可。

create extension if not exists vector;

create table if not exists sessions (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  created_at   timestamptz not null default now(),
  duration_sec int  not null default 0,
  source       text not null default 'paste' check (source in ('paste','audio','demo')),
  summary      text,
  tags         text[] not null default '{}'
);

create table if not exists segments (
  id         bigserial primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  idx        int  not null,
  t          int  not null,          -- 起始秒数
  text       text not null,
  embedding  vector(1536),           -- 配 embedding 模型后回填
  unique (session_id, idx)
);

create index if not exists segments_session_idx on segments (session_id, idx);
-- 向量索引（数据量上万条之后再建）
-- create index on segments using hnsw (embedding vector_cosine_ops);

-- 行级权限：默认只允许登录用户看自己的数据。
-- 单人部署可以不启用，多人时把 owner_id 加上并写 policy。
alter table sessions enable row level security;
alter table segments enable row level security;

-- create policy "own sessions" on sessions for all
--   using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
