alter table public.roleplay_sessions
  add column if not exists department_id uuid references public.departments(id) on delete set null;

update public.roleplay_sessions as sessions
set department_id = employees.primary_department_id
from public.employees as employees
where sessions.employee_id = employees.id
  and sessions.department_id is null
  and employees.primary_department_id is not null;

create index if not exists roleplay_sessions_department_completed_idx
  on public.roleplay_sessions (organization_id, department_id, completed_at desc);
