create table if not exists public.activity_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  raw_transcript text not null,
  separated_transcript jsonb,
  analysis jsonb,
  model text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id)
);

create index if not exists activity_ai_analyses_organization_updated_idx
  on public.activity_ai_analyses (organization_id, updated_at desc);
create index if not exists activity_ai_analyses_employee_updated_idx
  on public.activity_ai_analyses (employee_id, updated_at desc);

alter table public.activity_ai_analyses enable row level security;
revoke all on public.activity_ai_analyses from anon, authenticated;
