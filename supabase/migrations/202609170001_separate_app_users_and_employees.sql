begin;

-- 同一トランザクション内で既存業務データの件数を保全できたことを検査する。
create temporary table firebase_auth_migration_baseline on commit drop as
select
  (select count(*) from public.organizations) as organization_count,
  (select count(*) from public.customers) as customer_count,
  (select count(*) from public.activities) as activity_count;

create type public.app_user_status as enum ('active', 'inactive');
create type public.employee_status as enum ('active', 'inactive');

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legacy_profile_id uuid unique,
  name text not null,
  email text,
  primary_department_id uuid references public.departments(id) on delete set null,
  status public.employee_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text unique,
  legacy_profile_id uuid unique references public.profiles(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null unique references public.employees(id) on delete restrict,
  email text not null,
  role public.app_role not null default 'sales_rep',
  status public.app_user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.app_users add constraint app_users_email_key unique (email);

create table public.app_user_departments (
  app_user_id uuid not null references public.app_users(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  is_primary boolean not null default false,
  primary key (app_user_id, department_id)
);

insert into public.employees (
  organization_id, legacy_profile_id, name, email, primary_department_id, status, created_at, updated_at
)
select
  p.organization_id,
  p.id,
  p.display_name,
  p.email,
  primary_membership.department_id,
  case when p.is_active then 'active'::public.employee_status else 'inactive'::public.employee_status end,
  p.created_at,
  p.updated_at
from public.profiles p
left join lateral (
  select ud.department_id
  from public.user_departments ud
  where ud.user_id = p.id
  order by ud.is_primary desc, ud.department_id
  limit 1
) primary_membership on true;

insert into public.app_users (
  legacy_profile_id, organization_id, employee_id, email, role, status, created_at, updated_at
)
select
  p.id,
  p.organization_id,
  e.id,
  p.email,
  coalesce(role_choice.role, 'sales_rep'::public.app_role),
  case when p.is_active then 'active'::public.app_user_status else 'inactive'::public.app_user_status end,
  p.created_at,
  p.updated_at
from public.profiles p
join public.employees e on e.legacy_profile_id = p.id
left join lateral (
  select ur.role
  from public.user_roles ur
  where ur.user_id = p.id
  order by case ur.role
    when 'organization_admin' then 1
    when 'department_admin' then 2
    else 3
  end
  limit 1
) role_choice on true;

insert into public.app_user_departments (app_user_id, department_id, is_primary)
select au.id, ud.department_id, ud.is_primary
from public.app_users au
join public.user_departments ud on ud.user_id = au.legacy_profile_id;

alter table public.activities add column employee_id uuid;
update public.activities a
set employee_id = e.id
from public.employees e
where e.legacy_profile_id = a.owner_user_id;

do $$
begin
  if exists (select 1 from public.activities where employee_id is null) then
    raise exception 'activities employee migration failed: unresolved owner';
  end if;
  if (select count(*) from public.employees) <> (select count(*) from public.profiles) then
    raise exception 'employee migration count mismatch';
  end if;
  if (select count(*) from public.app_users) <> (select count(*) from public.profiles) then
    raise exception 'app user migration count mismatch';
  end if;
  if (select count(*) from public.organizations) <> (select organization_count from firebase_auth_migration_baseline) then
    raise exception 'organization count changed during migration';
  end if;
  if (select count(*) from public.customers) <> (select customer_count from firebase_auth_migration_baseline) then
    raise exception 'customer count changed during migration';
  end if;
  if (select count(*) from public.activities) <> (select activity_count from firebase_auth_migration_baseline) then
    raise exception 'activity count changed during migration';
  end if;
  if exists (
    select 1
    from public.activities a
    join public.employees e on e.id = a.employee_id
    where a.organization_id <> e.organization_id
       or a.owner_user_id is distinct from e.legacy_profile_id
  ) then
    raise exception 'activity employee assignment changed during migration';
  end if;
end
$$;

alter table public.activities alter column employee_id set not null;
alter table public.activities add constraint activities_employee_id_fkey
  foreign key (employee_id) references public.employees(id) on delete restrict;
create index activities_employee_starts_idx on public.activities (employee_id, starts_at);

-- Phase 1中も旧Supabase Auth経路から予定を登録できるようにする互換trigger。
create or replace function public.set_legacy_activity_employee()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.employee_id is null and new.owner_user_id is not null then
    select e.id into new.employee_id
    from public.employees e
    where e.legacy_profile_id = new.owner_user_id;
  end if;
  return new;
end
$$;

create trigger set_legacy_activity_employee_before_insert
before insert on public.activities
for each row execute function public.set_legacy_activity_employee();

alter table public.customers add column assigned_employee_id uuid references public.employees(id) on delete set null;
update public.customers c
set assigned_employee_id = e.id
from public.employees e
where e.legacy_profile_id = c.assigned_user_id;
create index customers_assigned_employee_idx on public.customers (assigned_employee_id);

-- 移行期間中はowner_user_id/assigned_user_idを旧コード互換用に残す。
-- Authユーザー削除を業務履歴が阻止しないよう、Authへ連鎖するFKのみ解除する。
alter table public.activities drop constraint activities_owner_user_id_fkey;
alter table public.customers drop constraint customers_assigned_user_id_fkey;
alter table public.activities alter column owner_user_id drop not null;

alter table public.employees enable row level security;
alter table public.app_users enable row level security;
alter table public.app_user_departments enable row level security;
revoke all on public.employees, public.app_users, public.app_user_departments from anon;

commit;
