-- A department manager who also performs their own sales activities.
alter type public.app_role add value if not exists 'department_admin_sales_rep';
