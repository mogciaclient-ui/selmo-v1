alter table public.activities
  add column if not exists schedule_details jsonb not null default '{}'::jsonb;
