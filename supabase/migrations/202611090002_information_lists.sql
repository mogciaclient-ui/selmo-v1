alter table public.personal_todos add column if not exists customer_name text not null default '' check (length(customer_name) <= 200);
create table if not exists public.processing_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete restrict,
  assignee_user_id uuid not null references public.app_users(id) on delete cascade,
  requested_by uuid references public.app_users(id) on delete set null,
  customer_name text not null check (length(btrim(customer_name)) between 1 and 200),
  content text not null check (length(btrim(content)) between 1 and 2000),
  due_date date not null,
  progress_note text not null default '' check (length(progress_note) <= 2000),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists processing_tasks_scope_idx on public.processing_tasks(organization_id, department_id, assignee_user_id, due_date);
alter table public.processing_tasks enable row level security;
revoke all on public.processing_tasks from anon, authenticated;
