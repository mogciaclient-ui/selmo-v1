-- PostgreSQL shortens generated multi-column constraint names. Remove the
-- original customer/month uniqueness; the case index now includes type/product.
alter table public.monthly_customer_pickups
  drop constraint if exists monthly_customer_pickups_employee_id_customer_id_target_mon_key;
