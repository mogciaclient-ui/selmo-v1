create extension if not exists pg_trgm;

create index if not exists customers_name_trgm_idx
on public.customers using gin (name gin_trgm_ops);

create or replace function public.search_customers(search_term text, result_limit integer default 20)
returns table (id uuid, name text, phone text, address text, department_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.name, c.phone, c.address, c.department_id
  from public.customers c
  where c.organization_id = public.current_organization_id()
    and c.department_id is not null
    and public.has_department_access(c.department_id)
    and (
      c.name ilike '%' || search_term || '%'
      or coalesce(c.phone, '') ilike '%' || search_term || '%'
    )
  order by
    case when c.name ilike search_term || '%' then 0 else 1 end,
    public.similarity(c.name, search_term) desc,
    c.name
  limit least(greatest(result_limit, 1), 20)
$$;

create or replace function public.create_activity_with_customer(
  target_department_id uuid,
  existing_customer_id uuid,
  customer_name text,
  activity_title text,
  target_activity_type text,
  activity_starts_at timestamptz,
  activity_ends_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_organization_id uuid := public.current_organization_id();
  resolved_customer_id uuid;
  created_activity_id uuid;
begin
  if actor_id is null or actor_organization_id is null then
    raise exception 'authentication required';
  end if;
  if not public.has_department_access(target_department_id) then
    raise exception 'department access denied';
  end if;
  if activity_ends_at <= activity_starts_at then
    raise exception 'end time must be after start time';
  end if;

  if existing_customer_id is not null then
    select c.id into resolved_customer_id
    from public.customers c
    where c.id = existing_customer_id
      and c.organization_id = actor_organization_id
      and c.department_id = target_department_id;

    if resolved_customer_id is null then
      raise exception 'customer not found in department';
    end if;
  else
    if nullif(btrim(customer_name), '') is null then
      raise exception 'customer name is required';
    end if;

    insert into public.customers (organization_id, department_id, name, assigned_user_id)
    values (actor_organization_id, target_department_id, btrim(customer_name), actor_id)
    returning id into resolved_customer_id;
  end if;

  insert into public.activities (
    organization_id, department_id, customer_id, owner_user_id,
    title, activity_type, starts_at, ends_at
  ) values (
    actor_organization_id, target_department_id, resolved_customer_id, actor_id,
    btrim(activity_title), target_activity_type, activity_starts_at, activity_ends_at
  ) returning id into created_activity_id;

  return created_activity_id;
end
$$;

revoke all on function public.search_customers(text, integer) from public;
revoke all on function public.create_activity_with_customer(uuid, uuid, text, text, text, timestamptz, timestamptz) from public;
grant execute on function public.search_customers(text, integer) to authenticated;
grant execute on function public.create_activity_with_customer(uuid, uuid, text, text, text, timestamptz, timestamptz) to authenticated;
