begin;
alter table public.opportunities add column if not exists merged_into_id uuid references public.opportunities(id) on delete cascade;
-- Keep duplicate records intact as aliases; choose the latest activity as the
-- current case, retain the entire visit date range, and reconnect every activity.
update public.opportunities set product_name = btrim(product_name) where product_name is not null and product_name <> btrim(product_name);
create temporary table case_canonical_map on commit drop as
select id, first_value(id) over (
  partition by organization_id, employee_id, customer_id, product_name
  order by coalesce(activity_to, activity_from, created_at::date) desc, updated_at desc, id
) as canonical_id
from public.opportunities where merged_into_id is null and nullif(product_name, '') is not null;

update public.opportunities current_case
set activity_from = dates.first_visit, activity_to = dates.last_visit
from (
  select m.canonical_id, min(coalesce(o.activity_from, o.activity_to)) as first_visit, max(coalesce(o.activity_to, o.activity_from)) as last_visit
  from case_canonical_map m join public.opportunities o on o.id = m.id group by m.canonical_id
) dates where current_case.id = dates.canonical_id;

update public.opportunities duplicate set merged_into_id = m.canonical_id
from case_canonical_map m where duplicate.id = m.id and m.id <> m.canonical_id;

update public.activities a
set schedule_details = coalesce(a.schedule_details, '{}'::jsonb) || jsonb_build_object('opportunityId', m.canonical_id::text)
from case_canonical_map m join public.opportunities o on o.id = m.id
where a.organization_id = o.organization_id and a.employee_id = o.employee_id and a.customer_id = o.customer_id
and (a.schedule_details->>'opportunityId' = o.id::text or a.id = o.source_activity_id);

create unique index if not exists opportunities_customer_product_owner_key
on public.opportunities(organization_id, employee_id, customer_id, product_name)
where merged_into_id is null and product_name is not null and product_name <> '';

-- Serialise reports for the same case so simultaneous revisits cannot create
-- duplicates or roll the current outcome back to an older activity date.
create or replace function public.sync_report_case(payload jsonb) returns uuid
language plpgsql set search_path = public as $$
declare
  org_id uuid := (payload->>'organizationId')::uuid;
  owner_id uuid := (payload->>'employeeId')::uuid;
  customer uuid := (payload->>'customerId')::uuid;
  activity uuid := (payload->>'activityId')::uuid;
  product text := btrim(payload->>'product');
  activity_day date := (payload->>'activityDate')::date;
  outcome text := payload->>'status';
  current_case public.opportunities%rowtype;
begin
  if nullif(product, '') is null then raise exception 'Product is required'; end if;
  if not exists (select 1 from public.activities where id = activity and organization_id = org_id and employee_id = owner_id and customer_id = customer) then
    raise exception 'Activity scope mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(org_id::text || ':' || owner_id::text || ':' || customer::text || ':' || product, 0));
  select * into current_case from public.opportunities
  where organization_id = org_id and employee_id = owner_id and customer_id = customer and product_name = product and merged_into_id is null for update;
  if not found then
    insert into public.opportunities(organization_id, department_id, employee_id, customer_id, name, product_name, status, confidence, stage, priority, expected_amount, order_amount, expected_close_date, sales_type, sales_process, progress_step, activity_from, activity_to)
    values(org_id, (payload->>'departmentId')::uuid, owner_id, customer, coalesce(nullif(btrim(payload->>'opportunityName'), ''), product), product, coalesce(outcome, 'open'), coalesce(payload->>'confidence', 'B'), case when outcome = 'won' then 'closing' else 'proposal' end, 'medium', 0, 0, activity_day, nullif(payload->>'salesType',''), nullif(payload->>'salesProcess',''), nullif(payload->>'progressStep',''), activity_day, activity_day)
    returning * into current_case;
  end if;
  update public.opportunities set
    activity_from = least(coalesce(current_case.activity_from, activity_day), activity_day),
    activity_to = greatest(coalesce(current_case.activity_to, activity_day), activity_day),
    status = case when current_case.activity_to is null or activity_day >= current_case.activity_to then coalesce(outcome, current_case.status) else current_case.status end,
    confidence = case when current_case.activity_to is null or activity_day >= current_case.activity_to then coalesce(payload->>'confidence', current_case.confidence) else current_case.confidence end,
    sales_type = case when current_case.activity_to is null or activity_day >= current_case.activity_to then coalesce(nullif(payload->>'salesType',''), current_case.sales_type) else current_case.sales_type end,
    sales_process = case when current_case.activity_to is null or activity_day >= current_case.activity_to then coalesce(nullif(payload->>'salesProcess',''), current_case.sales_process) else current_case.sales_process end,
    progress_step = case when current_case.activity_to is null or activity_day >= current_case.activity_to then coalesce(nullif(payload->>'progressStep',''), current_case.progress_step) else current_case.progress_step end,
    order_amount = case when outcome = 'won' and (current_case.activity_to is null or activity_day >= current_case.activity_to) and current_case.order_amount = 0 then current_case.expected_amount else current_case.order_amount end,
    updated_at = now()
  where id = current_case.id;
  update public.activities set schedule_details = coalesce(schedule_details, '{}'::jsonb) || jsonb_build_object('opportunityId', current_case.id::text)
  where id = activity and organization_id = org_id and employee_id = owner_id;
  return current_case.id;
end;
$$;
revoke all on function public.sync_report_case(jsonb) from public, anon, authenticated;
grant execute on function public.sync_report_case(jsonb) to service_role;
commit;
