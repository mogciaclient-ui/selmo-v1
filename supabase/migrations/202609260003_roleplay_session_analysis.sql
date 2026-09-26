alter table public.roleplay_sessions
  add column if not exists analysis jsonb,
  add column if not exists analysis_model text;
