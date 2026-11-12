create table if not exists public.personal_todos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  app_user_id uuid not null references public.app_users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 500),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists personal_todos_owner_idx on public.personal_todos(organization_id, app_user_id, created_at desc);
alter table public.personal_todos enable row level security;
revoke all on public.personal_todos from anon, authenticated;
