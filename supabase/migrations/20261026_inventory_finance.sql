-- Eterna Belleza: códigos automáticos y finanzas privadas.
-- Proyecto existente: ejecutar DESPUÉS de supabase/schema.sql, sin borrar datos.
-- Repetible; conserva códigos existentes, ventas, gastos y costos.
begin;

lock table public.products in share row exclusive mode;
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check check (
  category in ('Vestidos','Tops','Sport','Pantalones','Shorts','Blazers','Camisas','Infantiles','Otros')
);

create sequence if not exists public.eb_product_code_seq as bigint;
revoke all on sequence public.eb_product_code_seq from public, anon, authenticated;
do $$
declare existing_code bigint; sequence_code bigint;
begin
  select coalesce(max(substring(sku from 4)::bigint),0) into existing_code
    from public.products where sku ~ '^EB-[0-9]{1,15}$';
  select case when is_called then last_value else 0 end into sequence_code
    from public.eb_product_code_seq;
  perform pg_catalog.setval('public.eb_product_code_seq'::regclass,
    greatest(existing_code,sequence_code,1), greatest(existing_code,sequence_code) > 0);
end;
$$;

create or replace function public.eb_assign_product_code()
returns trigger language plpgsql security definer set search_path = '' as $$
declare code_number bigint; generated_code text;
begin
  if tg_op = 'UPDATE' then
    new.sku = old.sku;
    return new;
  end if;
  loop
    code_number = pg_catalog.nextval('public.eb_product_code_seq'::regclass);
    generated_code = 'EB-' || pg_catalog.lpad(code_number::text,
      greatest(4,length(code_number::text)), '0');
    exit when not exists (select 1 from public.products where lower(btrim(sku)) = lower(generated_code));
  end loop;
  new.sku = generated_code;
  return new;
end;
$$;
revoke all on function public.eb_assign_product_code() from public;
drop trigger if exists eb_product_automatic_code on public.products;
create trigger eb_product_automatic_code before insert or update of sku on public.products
  for each row execute function public.eb_assign_product_code();

-- El catálogo público NO recibe esta columna: el costo está en otra tabla con RLS.
create table if not exists public.product_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  purchase_cost numeric(12,0) not null check (purchase_cost >= 0 and purchase_cost <= 1000000000),
  updated_at timestamptz not null default now()
);
alter table public.product_costs enable row level security;
revoke all on public.product_costs from public, anon, authenticated;
grant select on public.product_costs to authenticated;
drop policy if exists eb_owner_reads_costs on public.product_costs;
create policy eb_owner_reads_costs on public.product_costs for select to authenticated
  using ((select public.is_owner()));

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  product_sku text not null,
  quantity integer not null check (quantity between 1 and 1000000),
  unit_price numeric(12,0) not null check (unit_price >= 0 and unit_price <= 1000000000),
  unit_cost numeric(12,0) not null check (unit_cost >= 0 and unit_cost <= 1000000000),
  sold_on date not null,
  payment_method text not null check (payment_method in ('Efectivo','Transferencia')),
  request_id uuid not null unique,
  voided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists eb_sales_month on public.sales (sold_on) where voided_at is null;
alter table public.sales enable row level security;
revoke all on public.sales from public, anon, authenticated;
grant select on public.sales to authenticated;
drop policy if exists eb_owner_reads_sales on public.sales;
create policy eb_owner_reads_sales on public.sales for select to authenticated using ((select public.is_owner()));

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null check (length(btrim(description)) between 1 and 200),
  category text not null default 'Otros' check (length(btrim(category)) between 1 and 80),
  amount numeric(12,0) not null check (amount > 0 and amount <= 1000000000),
  incurred_on date not null,
  created_at timestamptz not null default now()
);
create index if not exists eb_expenses_month on public.expenses(incurred_on);
alter table public.expenses enable row level security;
revoke all on public.expenses from public, anon, authenticated;
grant select,insert,update,delete on public.expenses to authenticated;
drop policy if exists eb_owner_manages_expenses on public.expenses;
create policy eb_owner_manages_expenses on public.expenses for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- Una operación guarda la prenda y su costo privado; falla todo o se guarda todo.
create or replace function public.save_inventory_product(
  product_data jsonb, purchase_cost numeric default null, product_id uuid default null
) returns public.products language plpgsql security definer set search_path = '' as $$
declare saved public.products; clean_name text; clean_size text; sale_price numeric; units integer;
begin
  if not public.is_owner() then
    raise exception 'Solo el propietario puede guardar prendas.' using errcode='42501';
  end if;
  if product_data is null or jsonb_typeof(product_data) <> 'object' then
    raise exception 'Los datos de la prenda no son válidos.' using errcode='22023';
  end if;
  clean_size = coalesce(btrim(product_data->>'size'),'');
  clean_name = coalesce(nullif(btrim(product_data->>'name'),''),
    coalesce(product_data->>'category','Prenda') || case when clean_size <> '' then ' · ' || clean_size else '' end);
  sale_price = nullif(product_data->>'price','')::numeric;
  units = coalesce(nullif(product_data->>'stock','')::integer,1);
  if units < 0 or units > 1000000 or length(clean_size) > 80 or length(clean_name) > 160 then
    raise exception 'Revisá el nombre, el talle y las unidades en stock.' using errcode='22023';
  end if;
  if sale_price is not null and not (sale_price between 0 and 1000000000 and sale_price = trunc(sale_price)) then
    raise exception 'Ingresá un precio de venta entero entre 0 y 1.000.000.000 Gs.' using errcode='22023';
  end if;
  if purchase_cost is not null and not (purchase_cost between 0 and 1000000000 and purchase_cost = trunc(purchase_cost)) then
    raise exception 'Ingresá un costo de compra entero entre 0 y 1.000.000.000 Gs.' using errcode='22023';
  end if;
  if product_id is null then
    insert into public.products(name,category,size,price,stock,image_path,visible,archived,is_example)
    values (clean_name,coalesce(product_data->>'category','Otros'),clean_size,sale_price,units,
      nullif(product_data->>'image_path',''),coalesce((product_data->>'visible')::boolean,true),
      coalesce((product_data->>'archived')::boolean,false),coalesce((product_data->>'is_example')::boolean,false))
    returning * into saved;
  else
    update public.products p set name=clean_name,category=coalesce(product_data->>'category','Otros'),
      size=clean_size,price=sale_price,stock=units,image_path=nullif(product_data->>'image_path',''),
      visible=coalesce((product_data->>'visible')::boolean,true),
      archived=coalesce((product_data->>'archived')::boolean,false),
      is_example=coalesce((product_data->>'is_example')::boolean,false)
    where p.id=product_id returning * into saved;
    if not found then raise exception 'La prenda ya no existe. Actualizá el inventario.' using errcode='P0002'; end if;
  end if;
  if purchase_cost is null then
    delete from public.product_costs c where c.product_id=saved.id;
  else
    insert into public.product_costs(product_id,purchase_cost) values(saved.id,purchase_cost)
    on conflict on constraint product_costs_pkey do update set purchase_cost=excluded.purchase_cost, updated_at=now();
  end if;
  return saved;
end;
$$;
revoke all on function public.save_inventory_product(jsonb,numeric,uuid) from public;
grant execute on function public.save_inventory_product(jsonb,numeric,uuid) to authenticated;

create or replace function public.record_sale(
  p_product_id uuid, p_quantity integer, p_unit_price numeric,
  p_sold_on date, p_payment_method text, p_request_id uuid
) returns public.sales language plpgsql security definer set search_path = '' as $$
declare item public.products; saved public.sales; cost numeric;
begin
  if not public.is_owner() then raise exception 'Solo el propietario puede registrar ventas.' using errcode='42501'; end if;
  if p_request_id is null then raise exception 'Falta el identificador de la venta. Volvé a intentarlo.' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into saved from public.sales where request_id=p_request_id;
  if found then
    if saved.product_id is distinct from p_product_id or saved.quantity is distinct from p_quantity
       or saved.unit_price is distinct from p_unit_price or saved.sold_on is distinct from p_sold_on
       or saved.payment_method is distinct from p_payment_method then
      raise exception 'Esta solicitud ya corresponde a otra venta. Actualizá la página.' using errcode='22023';
    end if;
    return saved;
  end if;
  if p_quantity is null or p_quantity not between 1 and 1000000 then
    raise exception 'La cantidad debe ser un entero mayor que cero.' using errcode='22023';
  end if;
  if p_unit_price is null or not (p_unit_price between 0 and 1000000000 and p_unit_price=trunc(p_unit_price)) then
    raise exception 'Ingresá un precio de venta válido en guaraníes enteros.' using errcode='22023';
  end if;
  if p_sold_on is null or p_sold_on > (now() at time zone 'America/Asuncion')::date then
    raise exception 'Elegí una fecha de venta válida, hasta hoy.' using errcode='22023';
  end if;
  if p_payment_method is null or p_payment_method not in ('Efectivo','Transferencia') then
    raise exception 'Elegí Efectivo o Transferencia.' using errcode='22023';
  end if;
  select * into item from public.products where id=p_product_id for update;
  if not found then raise exception 'La prenda ya no existe.' using errcode='P0002'; end if;
  if item.archived then raise exception 'Restaurá la prenda antes de registrar una venta.' using errcode='22023'; end if;
  if item.stock < p_quantity then raise exception 'No hay suficientes unidades para esta venta.' using errcode='22023'; end if;
  select c.purchase_cost into cost from public.product_costs c where c.product_id=item.id;
  if not found then raise exception 'Completá el precio de compra de la prenda antes de venderla.' using errcode='22023'; end if;
  update public.products set stock=stock-p_quantity where id=item.id;
  insert into public.sales(product_id,product_name,product_sku,quantity,unit_price,unit_cost,sold_on,payment_method,request_id)
    values(item.id,item.name,item.sku,p_quantity,p_unit_price,cost,p_sold_on,p_payment_method,p_request_id)
    returning * into saved;
  return saved;
end;
$$;
revoke all on function public.record_sale(uuid,integer,numeric,date,text,uuid) from public;
grant execute on function public.record_sale(uuid,integer,numeric,date,text,uuid) to authenticated;

create or replace function public.void_sale(p_sale_id uuid)
returns public.sales language plpgsql security definer set search_path = '' as $$
declare saved public.sales;
begin
  if not public.is_owner() then raise exception 'Solo el propietario puede anular ventas.' using errcode='42501'; end if;
  select * into saved from public.sales where id=p_sale_id for update;
  if not found then raise exception 'La venta ya no existe.' using errcode='P0002'; end if;
  if saved.voided_at is not null then return saved; end if;
  update public.products set stock=stock+saved.quantity where id=saved.product_id;
  update public.sales set voided_at=now() where id=saved.id returning * into saved;
  return saved;
end;
$$;
revoke all on function public.void_sale(uuid) from public;
grant execute on function public.void_sale(uuid) to authenticated;

commit;
