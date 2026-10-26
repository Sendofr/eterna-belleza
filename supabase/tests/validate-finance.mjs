/** Runs the production migrations in embedded PostgreSQL; Auth/Storage are mocks.
 * PGLITE_MODULE=/tmp/eb-sql-validation/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/validate-finance.mjs
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite')
const db = new PGlite()
let checks = 0
const owner = '00000000-0000-0000-0000-000000000100'
const outsider = '00000000-0000-0000-0000-000000000200'
const old = '00000000-0000-0000-0000-000000000001'
const request = '00000000-0000-0000-0000-000000000500'
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; console.log(`✓ ${label}`) }
async function denied(sql, label) { await assert.rejects(() => db.exec(sql), undefined, label); checks++; console.log(`✓ ${label}`) }
async function rows(sql) { return (await db.query(sql)).rows }
async function as(role, uid = '') { await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${uid}',false);`) }
async function save(data, cost = null, id = null) {
  return (await db.query('select * from public.save_inventory_product($1::jsonb,$2::numeric,$3::uuid)', [JSON.stringify(data),cost,id])).rows[0]
}
const input = {name:'Camisa de prueba',category:'Camisas',size:'M',price:100000,stock:5,visible:true,archived:false,is_example:false,image_path:null}
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text not null,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
    create function storage.extension(name text) returns text language sql immutable as $$ select regexp_replace(name,'^.*[.]','') $$;
    alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated;
    grant select on storage.objects to anon; grant select,insert,update,delete on storage.objects to authenticated;
  `)
  await db.exec(await readFile(new URL('../schema.sql',import.meta.url),'utf8'))
  await db.exec(`insert into auth.users values('${owner}'),('${outsider}'); insert into public.owner_accounts(user_id) values('${owner}');
    insert into public.products(id,name,sku,category,stock) values('${old}','Existente','EB-0007','Tops',3);
    insert into public.products(name,sku,category) values('Personalizado','ANTES-001','Vestidos');`)
  const migration = await readFile(new URL('../migrations/20261026_inventory_finance.sql',import.meta.url),'utf8')
  await db.exec(migration)
  await db.exec(migration)
  check((await rows(`select sku,stock from public.products where id='${old}'`))[0],{sku:'EB-0007',stock:3},'Migración repetible conserva códigos y stock existentes')
  await as('authenticated',owner)
  const item = await save(input,40000)
  check(item.sku,'EB-0008','Primer código continúa después de códigos existentes')
  check((await rows(`select purchase_cost::int as cost from public.product_costs where product_id='${item.id}'`))[0].cost,40000,'Costo guardado en tabla privada en la misma operación')
  check(Object.hasOwn(item,'purchase_cost'),false,'Respuesta pública de producto no contiene costo')
  const other = await save({...input,name:'Short',category:'Shorts',sku:'EB-0008'},0)
  check(other.sku,'EB-0009','Código proporcionado se ignora; altas no pueden duplicarlo')
  await db.exec(`update public.products set sku='OTRO' where id='${item.id}'`)
  check((await rows(`select sku from public.products where id='${item.id}'`))[0].sku,'EB-0008','Editar conserva código original')
  await db.exec('reset role')
  await db.exec(migration)
  await as('authenticated',owner)
  const rerun = await save({...input,category:'Blazers'},null)
  check(rerun.sku,'EB-0010','Reejecutar migración no retrocede la secuencia')
  const generatedName = await save({...input,name:'',category:'Infantiles',size:'4'},10000)
  check(generatedName.name,'Infantiles · 4','Nombre automático permite cargar sin nombre manual')
  await denied(`select public.save_inventory_product('{"name":"Inválido","category":"INVALID","stock":1}'::jsonb,100,null)`,'Categoría inválida revierte guardado')
  const countsBefore = (await rows('select count(*)::int as n from public.products'))[0].n
  await denied(`select public.save_inventory_product('{"name":"Inválido","category":"Tops","stock":1}'::jsonb,-1,null)`,'Costo negativo rechaza operación completa')
  check((await rows('select count(*)::int as n from public.products'))[0].n,countsBefore,'No se crean prendas parciales al fallar costo')
  await as('anon')
  await denied('select * from public.product_costs','Anónimo no puede leer costos')
  await denied('select * from public.sales','Anónimo no puede leer ventas')
  await denied('select * from public.expenses','Anónimo no puede leer gastos')
  await denied(`select public.record_sale('${item.id}',1,100000,'2026-01-01','Efectivo','${request}')`,'Anónimo no puede registrar ventas')
  await as('authenticated',outsider)
  check((await rows('select * from public.product_costs')).length,0,'Usuario común no ve costos por RLS')
  check((await rows('select * from public.sales')).length,0,'Usuario común no ve ventas por RLS')
  check((await rows('select * from public.expenses')).length,0,'Usuario común no ve gastos por RLS')
  await denied(`select public.save_inventory_product('{"name":"Intrusa","category":"Tops"}'::jsonb,1,null)`,'Usuario común no puede guardar costo mediante RPC')
  await denied(`select public.record_sale('${item.id}',1,100000,'2026-01-01','Efectivo','${request}')`,'Usuario común no puede registrar ventas mediante RPC')
  await denied("insert into public.expenses(description,amount,incurred_on) values('Intruso',100,'2026-01-01')",'Usuario común no puede cargar gastos')
  await as('authenticated',owner)
  const saleSQL = `select * from public.record_sale('${item.id}',2,100000,'2026-01-15','Transferencia','${request}')`
  const sale = (await rows(saleSQL))[0]
  check((await rows(`select stock from public.products where id='${item.id}'`))[0].stock,3,'Venta descuenta stock atómicamente')
  check(Number(sale.unit_cost),40000,'Venta conserva costo unitario al momento de vender')
  check((await rows(saleSQL))[0].id,sale.id,'Reintento devuelve la misma venta')
  check((await rows(`select stock from public.products where id='${item.id}'`))[0].stock,3,'Reintento no descuenta stock otra vez')
  await denied(`select public.record_sale('${item.id}',1,100000,'2026-01-15','Transferencia','${request}')`,'Solicitud repetida con otros datos se rechaza')
  await denied(`select public.record_sale('${item.id}',4,100000,'2026-01-15','Efectivo',gen_random_uuid())`,'Venta sin stock suficiente se rechaza')
  await denied(`select public.record_sale('${rerun.id}',1,100000,'2026-01-15','Efectivo',gen_random_uuid())`,'Venta sin costo conocido se rechaza')
  await denied(`select public.record_sale('${item.id}',1,100000,'2099-01-15','Efectivo',gen_random_uuid())`,'No permite venta con fecha futura')
  await denied(`select public.record_sale('${item.id}',1,100000,'2026-01-15','Tarjeta',gen_random_uuid())`,'Medio de pago debe ser uno habilitado')
  await save(input,70000,item.id)
  check(Number((await rows(`select unit_cost from public.sales where id='${sale.id}'`))[0].unit_cost),40000,'Cambiar costo actual no modifica ganancias históricas')
  await denied(`update public.sales set unit_price=0 where id='${sale.id}'`,'Ventas solo se modifican mediante RPC de auditoría')
  await denied(`insert into public.product_costs(product_id,purchase_cost) values('${old}',100)`,'Costos no se escriben directamente fuera de RPC')
  await db.exec("insert into public.expenses(description,category,amount,incurred_on) values('Bolsa','Insumos',10000,'2026-01-20'),('Luz','Servicios',5000,'2026-02-01')")
  const january = (await rows(`select
    (select coalesce(sum(quantity*unit_price),0)::int from public.sales where voided_at is null and sold_on >= '2026-01-01' and sold_on < '2026-02-01') as income,
    (select coalesce(sum(quantity*unit_cost),0)::int from public.sales where voided_at is null and sold_on >= '2026-01-01' and sold_on < '2026-02-01') as cost,
    (select coalesce(sum(amount),0)::int from public.expenses where incurred_on >= '2026-01-01' and incurred_on < '2026-02-01') as expenses`))[0]
  check(january,{income:200000,cost:80000,expenses:10000},'Resumen mensual separa ingresos, costo vendido y gastos por fecha')
  check(january.income-january.cost-january.expenses,110000,'Ganancia mensual resta costo vendido y gastos una sola vez')
  await denied("insert into public.expenses(description,amount,incurred_on) values('Inválido',0,'2026-01-01')",'Gasto debe ser positivo')
  const stockBeforeVoid=(await rows(`select stock from public.products where id='${item.id}'`))[0].stock
  await db.exec(`select public.void_sale('${sale.id}')`)
  check((await rows(`select stock from public.products where id='${item.id}'`))[0].stock,stockBeforeVoid+2,'Anular devuelve unidades al inventario')
  await db.exec(`select public.void_sale('${sale.id}')`)
  check((await rows(`select stock from public.products where id='${item.id}'`))[0].stock,stockBeforeVoid+2,'Anular dos veces no duplica devolución')
  check((await rows('select count(*)::int as n from public.sales where voided_at is null'))[0].n,0,'Ventas anuladas no cuentan como ingresos')
  check((await rows('select count(*)::int as n from public.sales'))[0].n,1,'Anular mantiene historial de auditoría')
  await save(input,null,item.id)
  check((await rows(`select * from public.product_costs where product_id='${item.id}'`)).length,0,'Vaciar costo vuelve a desconocido; no inventa costo cero')
  await db.exec('reset role; select setval(\'public.eb_product_code_seq\',9999,true)')
  await as('authenticated',owner)
  check((await save(input,1)).sku,'EB-10000','Código no se trunca después de 9999')
  await db.exec('reset role')
  await db.exec(migration)
  await as('authenticated',owner)
  check((await save(input,1)).sku,'EB-10001','Secuencia alta se conserva tras repetir migración')
  console.log(`\n${checks} comprobaciones de inventario/finanzas aprobadas. Auth y Storage simulados; sin conexión remota.`)
} finally { await db.close() }
