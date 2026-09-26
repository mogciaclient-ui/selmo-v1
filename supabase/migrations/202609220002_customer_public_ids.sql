create sequence if not exists public.customer_public_id_seq;

update public.customers
set external_id = 'C' || lpad(nextval('public.customer_public_id_seq')::text, 8, '0')
where external_id is null or btrim(external_id) = '';

alter table public.customers
  alter column external_id set default ('C' || lpad(nextval('public.customer_public_id_seq')::text, 8, '0')),
  alter column external_id set not null;

create unique index if not exists customers_organization_external_id_idx
  on public.customers (organization_id, external_id);
