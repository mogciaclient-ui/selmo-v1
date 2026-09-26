create or replace function public.current_organization_id() returns uuid language sql stable security definer set search_path = '' as $$
  select organization_id from public.profiles where id = (select auth.uid())
$$;

create or replace function public.is_organization_admin(target_organization_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join public.user_roles r on r.user_id = p.id
    where p.id = (select auth.uid()) and p.organization_id = target_organization_id
      and p.is_active and r.role = 'organization_admin'
  )
$$;

create or replace function public.has_department_access(target_department_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.departments d where d.id = target_department_id and (
      public.is_organization_admin(d.organization_id) or exists (
        select 1 from public.user_departments ud join public.profiles p on p.id = ud.user_id
        where ud.user_id = (select auth.uid()) and ud.department_id = d.id and p.is_active
      )
    )
  )
$$;

create or replace function public.is_department_admin(target_department_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.departments d where d.id = target_department_id and (
      public.is_organization_admin(d.organization_id) or exists (
        select 1 from public.user_roles r join public.profiles p on p.id = r.user_id
        where r.user_id = (select auth.uid()) and r.department_id = d.id
          and r.role = 'department_admin' and p.is_active
      )
    )
  )
$$;

revoke all on function public.current_organization_id() from public;
revoke all on function public.is_organization_admin(uuid) from public;
revoke all on function public.has_department_access(uuid) from public;
revoke all on function public.is_department_admin(uuid) from public;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.is_organization_admin(uuid) to authenticated;
grant execute on function public.has_department_access(uuid) to authenticated;
grant execute on function public.is_department_admin(uuid) to authenticated;

revoke all on public.organizations, public.departments, public.profiles, public.user_departments, public.user_roles, public.customers, public.activities from anon;
grant select, insert, update, delete on public.organizations, public.departments, public.profiles, public.user_departments, public.user_roles, public.customers, public.activities to authenticated;

create policy "organization members can view organization" on public.organizations for select to authenticated using (id = public.current_organization_id());
create policy "organization admins can update organization" on public.organizations for update to authenticated using (public.is_organization_admin(id)) with check (public.is_organization_admin(id));

create policy "members can view accessible departments" on public.departments for select to authenticated using (public.has_department_access(id));
create policy "organization admins can create departments" on public.departments for insert to authenticated with check (public.is_organization_admin(organization_id));
create policy "organization admins can update departments" on public.departments for update to authenticated using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));
create policy "organization admins can delete departments" on public.departments for delete to authenticated using (public.is_organization_admin(organization_id));

create policy "members can view accessible profiles" on public.profiles for select to authenticated using (
  id = (select auth.uid()) or public.is_organization_admin(organization_id) or exists (
    select 1 from public.user_departments viewer join public.user_departments target on target.department_id = viewer.department_id
    where viewer.user_id = (select auth.uid()) and target.user_id = profiles.id
  )
);
create policy "organization admins can manage profiles" on public.profiles for all to authenticated using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));

create policy "members can view accessible memberships" on public.user_departments for select to authenticated using (user_id = (select auth.uid()) or public.has_department_access(department_id));
create policy "admins can create memberships" on public.user_departments for insert to authenticated with check (public.is_department_admin(department_id));
create policy "admins can update memberships" on public.user_departments for update to authenticated using (public.is_department_admin(department_id)) with check (public.is_department_admin(department_id));
create policy "admins can delete memberships" on public.user_departments for delete to authenticated using (public.is_department_admin(department_id));

create policy "members can view applicable roles" on public.user_roles for select to authenticated using (
  user_id = (select auth.uid()) or (department_id is not null and public.is_department_admin(department_id)) or public.is_organization_admin(public.current_organization_id())
);
create policy "organization admins can manage roles" on public.user_roles for all to authenticated using (public.is_organization_admin(public.current_organization_id())) with check (public.is_organization_admin(public.current_organization_id()));

create policy "members can view department customers" on public.customers for select to authenticated using (organization_id = public.current_organization_id() and department_id is not null and public.has_department_access(department_id));
create policy "members can create department customers" on public.customers for insert to authenticated with check (organization_id = public.current_organization_id() and department_id is not null and public.has_department_access(department_id));
create policy "members can update department customers" on public.customers for update to authenticated using (organization_id = public.current_organization_id() and department_id is not null and public.has_department_access(department_id)) with check (organization_id = public.current_organization_id() and department_id is not null and public.has_department_access(department_id));
create policy "admins can delete department customers" on public.customers for delete to authenticated using (organization_id = public.current_organization_id() and department_id is not null and public.is_department_admin(department_id));

create policy "members can view department activities" on public.activities for select to authenticated using (organization_id = public.current_organization_id() and public.has_department_access(department_id));
create policy "members can create permitted activities" on public.activities for insert to authenticated with check (
  organization_id = public.current_organization_id() and public.has_department_access(department_id)
  and (owner_user_id = (select auth.uid()) or public.is_department_admin(department_id))
);
create policy "owners and admins can update activities" on public.activities for update to authenticated using (owner_user_id = (select auth.uid()) or public.is_department_admin(department_id)) with check (
  organization_id = public.current_organization_id() and public.has_department_access(department_id)
  and (owner_user_id = (select auth.uid()) or public.is_department_admin(department_id))
);
create policy "owners and admins can delete activities" on public.activities for delete to authenticated using (owner_user_id = (select auth.uid()) or public.is_department_admin(department_id));
