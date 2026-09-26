create table if not exists public.roleplay_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.app_users(id) on delete restrict,
  product_name text not null,
  category text not null check (category in ('新規', '既存')),
  target_segment text,
  challenge text,
  title text not null,
  customer_role text,
  difficulty text not null check (difficulty in ('やさしい', '標準', '難しい')),
  summary text,
  customer_profile text,
  practice_goal text not null,
  expected_objections text,
  scoring_criteria text,
  custom_fields jsonb not null default '[]'::jsonb,
  source_analysis_ids uuid[] not null default '{}',
  ai_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists roleplay_scenarios_organization_updated_idx
  on public.roleplay_scenarios (organization_id, updated_at desc);

alter table public.roleplay_scenarios enable row level security;
revoke all on public.roleplay_scenarios from anon, authenticated;
