create extension if not exists pgcrypto;
create extension if not exists vector;

create type public.app_role as enum ('sales_rep', 'department_admin', 'organization_admin');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null,
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_departments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  is_primary boolean not null default false,
  primary key (user_id, department_id)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  department_id uuid references public.departments(id) on delete cascade,
  unique nulls not distinct (user_id, role, department_id),
  check ((role = 'organization_admin' and department_id is null) or (role <> 'organization_admin' and department_id is not null))
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  external_id text,
  name text not null,
  phone text,
  postal_code text,
  address text,
  status text,
  assigned_user_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_organization_name_idx on public.customers (organization_id, name);
create index customers_organization_phone_idx on public.customers (organization_id, phone);
create index customers_department_idx on public.customers (department_id);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  activity_type text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled',
  result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index activities_owner_starts_idx on public.activities (owner_user_id, starts_at);
create index activities_department_starts_idx on public.activities (department_id, starts_at);
create index activities_customer_idx on public.activities (customer_id);

alter table public.organizations enable row level security;
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.user_departments enable row level security;
alter table public.user_roles enable row level security;
alter table public.customers enable row level security;
alter table public.activities enable row level security;

-- Exact visibility rules will be confirmed before policies are added.
-- With RLS enabled and no policies, public client keys cannot access these tables.
