create table if not exists public.monthly_customer_pickups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  target_month date not null check (target_month = date_trunc('month', target_month)::date),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, customer_id, target_month)
);

create index if not exists monthly_customer_pickups_scope_idx
  on public.monthly_customer_pickups (organization_id, target_month, department_id, employee_id);

alter table public.monthly_customer_pickups enable row level security;
revoke all on public.monthly_customer_pickups from anon, authenticated;

