alter table public.customers
  add column if not exists registration_details jsonb not null default '{}'::jsonb;
