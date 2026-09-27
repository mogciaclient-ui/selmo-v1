alter table public.activity_ai_analyses
  add column if not exists audio_path text,
  add column if not exists audio_duration_seconds numeric,
  add column if not exists audio_metrics jsonb;

create table if not exists public.employee_voice_references (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  storage_path text not null,
  content_type text not null,
  updated_at timestamptz not null default now()
);

alter table public.employee_voice_references enable row level security;
revoke all on public.employee_voice_references from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sales-audio',
  'sales-audio',
  false,
  26214400,
  array['audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/webm','video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
