-- 組織と利用部署だけを作成する開発用シード。

do $$
declare
  organization_id constant uuid := '11111111-1111-4111-8111-111111111111';
  sales_department_id constant uuid := '22222222-2222-4222-8222-222222222221';
  support_department_id constant uuid := '22222222-2222-4222-8222-222222222222';
begin
  insert into public.organizations (id, name) values (organization_id, 'Alpha Communications')
  on conflict (id) do update set name = excluded.name;

  insert into public.departments (id, organization_id, name) values
    (sales_department_id, organization_id, '営業'),
    (support_department_id, organization_id, 'AXCEL')
  on conflict (id) do update set organization_id = excluded.organization_id, name = excluded.name;
end
$$;
