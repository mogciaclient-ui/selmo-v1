create table public.personal_daily_reports (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id), employee_id uuid not null references public.employees(id) on delete cascade,
  report_date date not null, calls integer not null check(calls >= 0), appointments integer not null check(appointments >= 0),
  new_count integer not null check(new_count >= 0), user_count integer not null check(user_count >= 0),
  outside_minutes integer not null check(outside_minutes between 0 and 1440), notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(employee_id, report_date)
);
create index personal_daily_reports_scope_idx on public.personal_daily_reports(organization_id,department_id,report_date,employee_id);
alter table public.personal_daily_reports enable row level security;
revoke all on public.personal_daily_reports from anon, authenticated;

create table public.monthly_sales_goals (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id), employee_id uuid not null references public.employees(id) on delete cascade,
  closing_month date not null check(closing_month = date_trunc('month', closing_month)::date),
  target_count integer not null check(target_count >= 0), target_gross_profit bigint not null check(target_gross_profit >= 0),
  updated_at timestamptz not null default now(), unique(employee_id,closing_month)
);
alter table public.monthly_sales_goals enable row level security;
revoke all on public.monthly_sales_goals from anon, authenticated;

create table public.visit_check_sheets (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id), employee_id uuid not null references public.employees(id) on delete cascade,
  activity_id uuid not null unique references public.activities(id) on delete cascade, customer_id uuid references public.customers(id) on delete set null,
  visit_date date not null, customer_name text not null, address text not null default '', telephone text not null default '', fax text not null default '',
  contact_name text not null default '', contact_title text not null default '', collaboration text not null default '', axcel text not null default '',
  equipment jsonb not null default '[]', network jsonb not null default '{}', notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index visit_check_sheets_scope_idx on public.visit_check_sheets(organization_id,department_id,employee_id,visit_date);
alter table public.visit_check_sheets enable row level security;
revoke all on public.visit_check_sheets from anon, authenticated;

create table public.sales_manuals (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete cascade,
  title text not null check(length(btrim(title)) between 1 and 200), content text not null check(length(btrim(content)) between 1 and 20000),
  active boolean not null default true, updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.sales_manuals enable row level security;
revoke all on public.sales_manuals from anon, authenticated;
