create table if not exists public.roleplay_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  scenario_id uuid references public.roleplay_scenarios(id) on delete set null,
  scenario_key text,
  title text not null,
  product_name text,
  category text,
  score integer not null check (score between 0 and 100),
  messages jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists roleplay_sessions_employee_completed_idx
  on public.roleplay_sessions (organization_id, employee_id, completed_at desc);

alter table public.roleplay_sessions enable row level security;
revoke all on public.roleplay_sessions from anon, authenticated;
