/** PostgreSQL real embebido. No conecta al proyecto remoto.
 * npm install --prefix /tmp/eb-sql-validation --cache /tmp/eb-npm-cache @electric-sql/pglite
 * PGLITE_MODULE=/tmp/eb-sql-validation/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/validate.mjs
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite')
const db = new PGlite()
let assertions = 0
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); assertions++; console.log(`✓ ${label}`) }
async function denied(sql, label) {
  await assert.rejects(() => db.exec(sql), undefined, label)
  assertions++
  console.log(`✓ ${label}`)
}
const owner = '00000000-0000-0000-0000-000000000100'
const outsider = '00000000-0000-0000-0000-000000000200'
const product = '00000000-0000-0000-0000-000000000001'
async function as(role, uid = '') {
  await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${uid}',false);`)
}
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create schema storage;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid;
    $$;
    create table storage.buckets (id text primary key, name text not null, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text);
    create function storage.extension(name text) returns text language sql immutable as $$ select regexp_replace(name, '^.*[.]', ''); $$;
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to anon, authenticated;
    grant select on storage.objects to anon;
    grant select, insert, update, delete on storage.objects to authenticated;
  `)
  const migration = await readFile(new URL('../schema.sql', import.meta.url), 'utf8')
  await db.exec(migration)
  await db.exec(migration)
  check(true, true, 'Migración aplicada dos veces sin borrar datos ni fallar')
  await db.exec(`
    insert into auth.users values ('${owner}'), ('${outsider}');
    insert into public.owner_accounts(user_id) values ('${owner}');
    insert into public.products(id,name,sku,category,stock) values ('${product}','Vestido','V-01','Vestidos',1);
    insert into public.products(name,sku,category,visible) values ('Oculta','H-01','Tops',false);
    insert into public.products(name,sku,category,archived) values ('Archivada','A-01','Otros',true);
    insert into public.products(name,sku,category,stock) values ('Agotada','S-01','Sport',0);
  `)
  const bucket = (await db.query('select public,file_size_limit,allowed_mime_types from storage.buckets')).rows[0]
  check(bucket, {public:true, file_size_limit:2097152, allowed_mime_types:['image/webp']}, 'Bucket público limitado a WebP y 2 MiB')
  await as('anon')
  check((await db.query('select count(*)::int as n from public.products')).rows[0].n, 2, 'Anónimo solo ve visibles no archivadas; agotadas permanecen visibles')
  check((await db.query('select public.is_owner() as value')).rows[0].value, false, 'Anónimo no es propietario')
  await denied("insert into public.products(name,sku,category) values ('Intrusa','X','Otros')", 'Anónimo no puede insertar productos')
  await denied('select * from public.owner_accounts', 'Anónimo no puede leer autorizaciones')
  await denied(`select public.adjust_stock('${product}',1)`, 'Anónimo no puede ejecutar ajustes de stock')
  await as('authenticated', outsider)
  check((await db.query('select public.is_owner() as value')).rows[0].value, false, 'Usuario autenticado común no es propietario')
  check((await db.query('select count(*)::int as n from public.products')).rows[0].n, 2, 'Usuario común no puede leer ocultas ni archivadas')
  await denied(`insert into public.owner_accounts(user_id) values ('${outsider}')`, 'Usuario común no puede autorizarse como dueño')
  await denied("insert into public.products(name,sku,category) values ('Intrusa','X','Otros')", 'Usuario común no puede insertar productos')
  await denied(`select public.adjust_stock('${product}',1)`, 'Usuario común no puede modificar stock mediante RPC')
  await denied("insert into storage.objects(bucket_id,name) values ('product-images','intrusa.webp')", 'Usuario común no puede subir fotos')
  await db.exec(`update public.products set stock=99 where id='${product}'; delete from public.products where id='${product}';`)
  check((await db.query(`select stock from public.products where id='${product}'`)).rows[0].stock,1,'RLS impide update/delete de usuario común')
  await as('authenticated', owner)
  check((await db.query('select public.is_owner() as value')).rows[0].value, true, 'UUID autorizado es propietario')
  check((await db.query('select count(*)::int as n from public.products')).rows[0].n, 4, 'Propietario ve todas las prendas')
  check((await db.query('select count(*)::int as n from public.owner_accounts')).rows[0].n,1,'Propietario puede leer su autorización')
  const lowered = (await db.query(`select (public.adjust_stock('${product}',-1)).stock`)).rows[0].stock
  check(lowered,0,'RPC reduce stock y devuelve fila actualizada')
  await denied(`select public.adjust_stock('${product}',-1)`, 'RPC rechaza stock negativo')
  await denied(`select public.adjust_stock('${product}',9)`, 'RPC rechaza delta diferente de ±1')
  const raised = (await db.query(`select (public.adjust_stock('${product}',1)).stock`)).rows[0].stock
  check(raised,1,'RPC incrementa stock desde cero')
  await denied("insert into public.products(name,sku,category) values ('Duplicado',' v-01 ','Vestidos')",'SKU único ignora mayúsculas y espacios exteriores')
  await denied("insert into public.products(name,sku,category,stock) values ('Inválida','BAD','Otros',-1)",'Restricción de tabla rechaza stock negativo')
  await denied("insert into public.products(name,sku,category,price) values ('Inválida','BAD','Otros',-1)",'Restricción de tabla rechaza precio negativo')
  await db.exec("insert into public.products(name,sku,category) values ('Nueva','N-01','Otros')")
  check((await db.query("select name from public.products where sku='N-01'")).rows[0].name,'Nueva','Propietario puede crear una prenda')
  await db.exec("insert into storage.objects(bucket_id,name) values ('product-images','owner/photo.webp')")
  await denied("insert into storage.objects(bucket_id,name) values ('product-images','owner/photo.png')", 'Política de Storage rechaza extensión diferente de WebP')
  await db.exec("delete from storage.objects where name='owner/photo.webp'")
  check((await db.query('select count(*)::int as n from storage.objects')).rows[0].n,0,'Propietario puede borrar fotos')
  await db.exec("update public.products set archived=true where sku='N-01'")
  await as('anon')
  check((await db.query("select count(*)::int as n from public.products where sku='N-01'")).rows[0].n,0,'Archivar retira la prenda del catálogo público')
  console.log(`\n${assertions} comprobaciones PostgreSQL superadas. Auth y Storage son esquemas simulados.`)
} finally {
  await db.close()
}
