alter table public.monthly_customer_pickups
  add column if not exists customer_type text not null default '新規' check (customer_type in ('新規', 'GUP', '他商材')),
  add column if not exists product text not null default '',
  add column if not exists estimated_profit bigint not null default 0 check (estimated_profit >= 0),
  add column if not exists updated_by uuid references public.app_users(id) on delete set null;

-- One customer can have multiple target cases within the same month.
alter table public.monthly_customer_pickups drop constraint if exists monthly_customer_pickups_employee_id_customer_id_target_month_key;
create unique index if not exists monthly_customer_pickups_case_key
  on public.monthly_customer_pickups(employee_id, customer_id, target_month, customer_type, product);

create table if not exists public.target_note_history (
  id uuid primary key default gen_random_uuid(),
  pickup_id uuid not null references public.monthly_customer_pickups(id) on delete cascade,
  previous_note text,
  note text,
  changed_by uuid references public.app_users(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists target_note_history_pickup_idx on public.target_note_history(pickup_id, changed_at desc);
alter table public.target_note_history enable row level security;
revoke all on public.target_note_history from anon, authenticated;

create or replace function public.record_target_note_history() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.reason is not null then
      insert into public.target_note_history(pickup_id, note, changed_by) values(new.id, new.reason, new.updated_by);
    end if;
  elsif new.reason is distinct from old.reason then
    insert into public.target_note_history(pickup_id, previous_note, note, changed_by) values(new.id, old.reason, new.reason, new.updated_by);
  end if;
  return new;
end;
$$;
drop trigger if exists record_target_note_history on public.monthly_customer_pickups;
create trigger record_target_note_history after insert or update on public.monthly_customer_pickups
for each row execute function public.record_target_note_history();

create or replace function public.stamp_target_update() returns trigger
language plpgsql set search_path = public as $$
begin
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists stamp_target_update on public.monthly_customer_pickups;
create trigger stamp_target_update before update on public.monthly_customer_pickups
for each row execute function public.stamp_target_update();
