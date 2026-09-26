create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_no text,
  name text not null,
  name_kana text,
  model_number text,
  price numeric(14,0),
  size text,
  weight text,
  capacity text,
  color text,
  manufacturer_name text,
  manufacturer_url text,
  description text,
  notes text,
  action_process text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);
create index if not exists products_organization_name_idx on public.products (organization_id, name);
alter table public.products enable row level security;
revoke all on public.products from anon, authenticated;

