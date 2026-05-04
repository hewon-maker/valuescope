-- ValueScope DB 스키마
-- Supabase Dashboard → SQL Editor 에 그대로 붙여넣어 실행

-- 1) projects: 컨설팅 프로젝트 (고객사 한 곳 = 한 프로젝트)
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  client_name text,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_projects_owner on public.projects(owner_id);

-- 2) uploads: 업로드된 원본 파일 메타 (실제 파일은 Storage)
create table if not exists public.uploads (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  kind        text not null check (kind in ('survey', 'interview')),
  filename    text not null,
  storage_path text not null,
  size_bytes  bigint,
  uploaded_at timestamptz not null default now()
);
create index if not exists idx_uploads_project on public.uploads(project_id);

-- 3) analyses: 분석 결과 JSON
create table if not exists public.analyses (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  survey_json  jsonb,
  interview_json jsonb,
  mindmap_json jsonb,
  status       text not null default 'pending' check (status in ('pending', 'analyzing', 'ready', 'failed')),
  error_message text,
  generated_at timestamptz not null default now(),
  unique (project_id)
);
create index if not exists idx_analyses_project on public.analyses(project_id);

-- 4) RLS — 사용자는 자기 프로젝트만 접근
alter table public.projects  enable row level security;
alter table public.uploads   enable row level security;
alter table public.analyses  enable row level security;

drop policy if exists "own projects all" on public.projects;
create policy "own projects all" on public.projects
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "own uploads all" on public.uploads;
create policy "own uploads all" on public.uploads
  for all using (
    project_id in (select id from public.projects where owner_id = auth.uid())
  ) with check (
    project_id in (select id from public.projects where owner_id = auth.uid())
  );

drop policy if exists "own analyses all" on public.analyses;
create policy "own analyses all" on public.analyses
  for all using (
    project_id in (select id from public.projects where owner_id = auth.uid())
  ) with check (
    project_id in (select id from public.projects where owner_id = auth.uid())
  );

-- 5) updated_at 자동 갱신
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists set_updated_at on public.projects;
create trigger set_updated_at before update on public.projects
  for each row execute function public.tg_set_updated_at();

-- 6) Storage 버킷 (Dashboard → Storage 에서 만들거나 아래로)
-- insert into storage.buckets (id, name, public) values ('uploads', 'uploads', false)
--   on conflict (id) do nothing;
-- create policy "own files" on storage.objects for all
--   using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
