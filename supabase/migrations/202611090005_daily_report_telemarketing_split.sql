-- Legacy totals are retained. Their new/user split is unknown until re-entered.
alter table public.personal_daily_reports
  add column new_calls integer check(new_calls >= 0),
  add column new_appointments integer check(new_appointments >= 0),
  add column user_calls integer check(user_calls >= 0),
  add column user_appointments integer check(user_appointments >= 0);
