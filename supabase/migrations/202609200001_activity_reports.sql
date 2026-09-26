alter table public.activities
  add column if not exists common_report jsonb;

create table if not exists public.activity_individual_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  report jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, employee_id)
);
create index if not exists activity_individual_reports_activity_idx on public.activity_individual_reports (activity_id);
alter table public.activity_individual_reports enable row level security;
revoke all on public.activity_individual_reports from anon, authenticated;
