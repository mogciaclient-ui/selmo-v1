begin;

-- Firebase移行後はBrowser/anon/authenticatedから業務テーブルへ直接アクセスさせない。
revoke all on public.organizations, public.departments, public.profiles, public.user_departments,
  public.user_roles, public.customers, public.activities, public.employees, public.app_users,
  public.app_user_departments from anon, authenticated;
grant all on public.organizations, public.departments, public.profiles, public.user_departments,
  public.user_roles, public.customers, public.activities, public.employees, public.app_users,
  public.app_user_departments to service_role;

drop policy if exists "organization members can view organization" on public.organizations;
drop policy if exists "organization admins can update organization" on public.organizations;
drop policy if exists "members can view accessible departments" on public.departments;
drop policy if exists "organization admins can create departments" on public.departments;
drop policy if exists "organization admins can update departments" on public.departments;
drop policy if exists "organization admins can delete departments" on public.departments;
drop policy if exists "members can view accessible profiles" on public.profiles;
drop policy if exists "organization admins can manage profiles" on public.profiles;
drop policy if exists "members can view accessible memberships" on public.user_departments;
drop policy if exists "admins can create memberships" on public.user_departments;
drop policy if exists "admins can update memberships" on public.user_departments;
drop policy if exists "admins can delete memberships" on public.user_departments;
drop policy if exists "members can view applicable roles" on public.user_roles;
drop policy if exists "organization admins can manage roles" on public.user_roles;
drop policy if exists "members can view department customers" on public.customers;
drop policy if exists "members can create department customers" on public.customers;
drop policy if exists "members can update department customers" on public.customers;
drop policy if exists "admins can delete department customers" on public.customers;
drop policy if exists "members can view department activities" on public.activities;
drop policy if exists "members can create permitted activities" on public.activities;
drop policy if exists "owners and admins can update activities" on public.activities;
drop policy if exists "owners and admins can delete activities" on public.activities;

drop function if exists public.search_customers(text, integer);
drop function if exists public.create_activity_with_customer(uuid, uuid, text, text, text, timestamptz, timestamptz);
drop function if exists public.current_organization_id();
drop function if exists public.has_department_access(uuid);
drop function if exists public.is_department_admin(uuid);
drop function if exists public.is_organization_admin(uuid);

-- Phase 1だけで必要だったSupabase Auth互換処理を撤去する。
drop trigger if exists set_legacy_activity_employee_before_insert on public.activities;
drop function if exists public.set_legacy_activity_employee();

-- profilesは移行監査用に残すが、auth.usersとのライフサイクル依存を解除する。
alter table public.profiles drop constraint if exists profiles_id_fkey;

commit;
