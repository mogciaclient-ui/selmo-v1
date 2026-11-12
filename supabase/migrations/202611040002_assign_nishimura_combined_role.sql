-- Keep the existing Firebase UID, employee, organization, and memberships.
update public.app_users
set role = 'department_admin_sales_rep', updated_at = now()
where firebase_uid = 'xubZZDsisaVPLJTdePs2gZrn6Kn2'
  and role = 'department_admin';
