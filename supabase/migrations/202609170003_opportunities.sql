create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  name text not null,
  product_name text,
  stage text not null default 'approach' check (stage in ('approach','discovery','proposal','closing')),
  status text not null default 'open' check (status in ('open','won','lost','on_hold')),
  confidence text not null default 'B' check (confidence in ('A','B','C','D')),
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  expected_amount numeric(14,0) not null default 0 check (expected_amount >= 0),
  expected_close_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists opportunities_organization_idx on public.opportunities (organization_id);
create index if not exists opportunities_employee_idx on public.opportunities (employee_id, status);
create index if not exists opportunities_department_idx on public.opportunities (department_id, status);
create index if not exists opportunities_customer_idx on public.opportunities (customer_id);
alter table public.opportunities enable row level security;
revoke all on public.opportunities from anon, authenticated;
