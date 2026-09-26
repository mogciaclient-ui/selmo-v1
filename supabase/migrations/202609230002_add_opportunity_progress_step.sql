alter table public.opportunities
  add column if not exists progress_step text;
