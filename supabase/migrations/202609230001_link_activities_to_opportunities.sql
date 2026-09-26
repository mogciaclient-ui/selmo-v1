alter table public.opportunities
  add column if not exists source_activity_id uuid references public.activities(id) on delete set null;

create unique index if not exists opportunities_source_activity_idx
  on public.opportunities (source_activity_id)
  where source_activity_id is not null;
