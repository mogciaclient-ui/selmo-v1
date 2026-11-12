alter table public.activities add column if not exists completed_at timestamptz;
alter table public.activities add column if not exists was_overdue boolean not null default false;

-- The original completion time of legacy reports is unknown. Preserve their
-- existing completed state without retroactively labelling them overdue.
update public.activities
set completed_at = updated_at,
    was_overdue = false
where completed_at is null and (status = 'completed' or nullif(btrim(result), '') is not null);

create or replace function public.track_activity_completion() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'completed' or nullif(btrim(new.result), '') is not null then
    if tg_op = 'UPDATE' then
      new.completed_at := coalesce(old.completed_at, now());
      new.was_overdue := case when old.completed_at is not null then old.was_overdue else
        old.was_overdue or ((new.completed_at at time zone 'Asia/Tokyo')::date > (old.starts_at at time zone 'Asia/Tokyo')::date) end;
    else
      new.completed_at := coalesce(new.completed_at, now());
      new.was_overdue := (new.completed_at at time zone 'Asia/Tokyo')::date > (new.starts_at at time zone 'Asia/Tokyo')::date;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists track_activity_completion on public.activities;
create trigger track_activity_completion before insert or update on public.activities
for each row execute function public.track_activity_completion();

create index if not exists activities_missing_results_idx on public.activities (organization_id, department_id, employee_id, starts_at)
where activity_type in ('visit', 'online') and status = 'scheduled' and result is null;
