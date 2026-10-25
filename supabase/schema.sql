-- Eterna Belleza — ejecutar en el SQL Editor de un proyecto Supabase.
-- No contiene cuentas, claves ni credenciales. Se puede volver a ejecutar.
-- Requiere los esquemas auth y storage provistos por Supabase.
begin;

create table if not exists public.owner_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Zuni Bogado',
  created_at timestamptz not null default now()
);

alter table public.owner_accounts enable row level security;
revoke all on table public.owner_accounts from anon, authenticated;
grant select on table public.owner_accounts to authenticated;

drop policy if exists eb_owner_reads_self on public.owner_accounts;
create policy eb_owner_reads_self on public.owner_accounts
  for select to authenticated using (user_id = (select auth.uid()));

-- SECURITY DEFINER solo consulta una tabla sin escritura y usa nombres completos.
-- El usuario de la aplicación no puede concederse el rol de propietario.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.owner_accounts where user_id = auth.uid()
  );
$$;
revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  sku text not null check (length(btrim(sku)) between 1 and 64),
  category text not null check (category in ('Vestidos', 'Tops', 'Sport', 'Pantalones', 'Otros')),
  size text not null default '' check (length(size) <= 100),
  price numeric(12,0) check (price is null or price >= 0),
  stock integer not null default 1 check (stock >= 0),
  image_path text check (image_path is null or (length(image_path) <= 512 and image_path ~ '\.webp$')),
  visible boolean not null default true,
  archived boolean not null default false,
  is_example boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists eb_products_sku_unique on public.products (lower(btrim(sku)));
create index if not exists eb_products_catalog on public.products (category, created_at desc)
  where visible = true and archived = false;

create or replace function public.eb_touch_product()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.eb_touch_product() from public;
drop trigger if exists eb_product_updated_at on public.products;
create trigger eb_product_updated_at before update on public.products
  for each row execute function public.eb_touch_product();

alter table public.products enable row level security;
revoke all on table public.products from anon, authenticated;
grant select on table public.products to anon, authenticated;
grant insert, update, delete on table public.products to authenticated;

drop policy if exists eb_public_catalog on public.products;
create policy eb_public_catalog on public.products
  for select to anon, authenticated using (visible and not archived);

drop policy if exists eb_owner_reads_products on public.products;
create policy eb_owner_reads_products on public.products
  for select to authenticated using ((select public.is_owner()));

drop policy if exists eb_owner_inserts_products on public.products;
create policy eb_owner_inserts_products on public.products
  for insert to authenticated with check ((select public.is_owner()));

drop policy if exists eb_owner_updates_products on public.products;
create policy eb_owner_updates_products on public.products
  for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

drop policy if exists eb_owner_deletes_products on public.products;
create policy eb_owner_deletes_products on public.products
  for delete to authenticated using ((select public.is_owner()));

-- Actualización atómica: dos clics/clientes concurrentes no pisan el stock.
-- SECURITY INVOKER conserva RLS y comprueba autorización explícitamente.
create or replace function public.adjust_stock(product_id uuid, delta integer)
returns public.products
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed public.products;
begin
  if not public.is_owner() then
    raise exception 'Solo el propietario puede modificar el inventario.' using errcode = '42501';
  end if;
  if delta is null or delta not in (-1, 1) then
    raise exception 'El ajuste debe ser +1 o -1.' using errcode = '22023';
  end if;

  update public.products
  set stock = stock + delta
  where id = product_id and stock::bigint + delta between 0 and 2147483647
  returning * into changed;

  if not found then
    if exists (select 1 from public.products where id = product_id) then
      raise exception 'El stock no puede quedar fuera de rango.' using errcode = '22003';
    end if;
    raise exception 'La prenda ya no existe.' using errcode = 'P0002';
  end if;
  return changed;
end;
$$;
revoke all on function public.adjust_stock(uuid, integer) from public;
grant execute on function public.adjust_stock(uuid, integer) to authenticated;

-- Bucket de fotos de catálogo. La app convierte/reduce las imágenes ANTES de subir.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists eb_public_product_images on storage.objects;
create policy eb_public_product_images on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-images');

drop policy if exists eb_owner_upload_product_images on storage.objects;
create policy eb_owner_upload_product_images on storage.objects
  for insert to authenticated with check (
    bucket_id = 'product-images' and (select public.is_owner())
    and lower(storage.extension(name)) = 'webp'
  );

drop policy if exists eb_owner_update_product_images on storage.objects;
create policy eb_owner_update_product_images on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_owner()))
  with check (
    bucket_id = 'product-images' and (select public.is_owner())
    and lower(storage.extension(name)) = 'webp'
  );

drop policy if exists eb_owner_delete_product_images on storage.objects;
create policy eb_owner_delete_product_images on storage.objects
  for delete to authenticated using (
    bucket_id = 'product-images' and (select public.is_owner())
  );

commit;

-- PASO MANUAL, una vez creada la cuenta en Authentication > Users:
-- Sustituí TU_UUID por el UUID de la cuenta de Zuni Bogado. El nombre no autentica.
-- insert into public.owner_accounts (user_id, display_name)
-- values ('TU_UUID'::uuid, 'Zuni Bogado')
-- on conflict (user_id) do update set display_name = excluded.display_name;
