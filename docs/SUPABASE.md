# Supabase: instalación y cuenta del propietario

La primera versión puede probarse sin Supabase en modo de demostración local. Ese modo no representa una sesión de Zuni Bogado ni publica un inventario real. En esta entrega no se dispone de un proyecto, credenciales ni una cuenta Supabase conectada; la integración remota necesita estos pasos y su validación en el proyecto real.

## 1. Crear la base de datos

1. Abrí un proyecto Supabase propio y su **SQL Editor**.
2. Ejecutá el contenido completo de [`supabase/schema.sql`](../supabase/schema.sql). Creará las tablas, funciones, políticas de acceso y el bucket. Podés ejecutarlo de nuevo: no borra productos ni cuentas autorizadas.
3. Si el proyecto ya contiene tablas o políticas con otros nombres, revisalas antes: las políticas permisivas de PostgreSQL se combinan con OR. Este script solo reemplaza las políticas que crea, cuyo prefijo es `eb_`; no elimina políticas ajenas ni migra esquemas previos incompatibles.

No se insertan productos ficticios en Supabase. El catálogo real arranca vacío; la demostración local usa ejemplos identificados como tales.

## 2. Autorizar a Zuni Bogado

1. En **Authentication → Users**, creá la cuenta del propietario con su correo y contraseña segura. No publiques esos datos en el código ni en el chat. La web no ofrece registro público.
2. Copiá el **User UID** de esa cuenta.
3. Ejecutá como administrador en SQL Editor, sustituyendo el valor:

```sql
insert into public.owner_accounts (user_id, display_name)
values ('REEMPLAZAR-POR-UUID-REAL'::uuid, 'Zuni Bogado')
on conflict (user_id) do update
set display_name = excluded.display_name;
```

La autorización depende del UUID devuelto por Supabase Auth. Tener un perfil llamado «Zuni Bogado», conocer la URL del panel o cambiar datos del navegador no concede acceso. Un usuario autenticado no puede agregarse a `owner_accounts`.

Para retirar el permiso:

```sql
delete from public.owner_accounts where user_id = 'UUID-DEL-USUARIO'::uuid;
```

Si retirás el permiso con una sesión abierta, recargá el panel. RLS bloquea las escrituras inmediatamente aunque el navegador conserve la sesión.

## 3. Conectar la aplicación

Copiá `.env.example` a `.env.local`. Configurá:

- `VITE_SUPABASE_URL`: URL pública del proyecto, desde Project Settings → API.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: clave **publishable** del mismo proyecto (también admite una clave pública legacy **anon**; `VITE_SUPABASE_ANON_KEY` se acepta como alias de compatibilidad).

Son datos públicos de conexión usados en el frontend. **Nunca** uses `service_role`, una clave secreta `sb_secret_…`, la contraseña de PostgreSQL ni un token de administración en una variable `VITE_*`. Estas variables quedan incluidas en el JavaScript que descarga el visitante.

Reiniciá `npm run dev` después de editar las variables; reconstruí `npm run build` para desplegar cambios. Si el entorno aplica una lista de dominios permitidos, necesitás HTTPS hacia el hostname de tu proyecto (`<project-ref>.supabase.co`). No hay un proyecto concreto que pueda añadirse antes de conocer esa URL.

En **Authentication → URL Configuration**, configurá Site URL y las redirect URLs del dominio final; añadí también el origen de desarrollo si vas a usar enlaces de recuperación. La autenticación actual usa correo/contraseña. No requiere Google OAuth ni acceso a la sesión de la demo de Terramoda.

### Si publicás en Vercel

En el proyecto de Vercel abrí **Settings → Environment Variables** y agregá `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con los datos públicos del mismo proyecto Supabase donde creaste al usuario. Habilitalas para **Production** (y Preview si lo usás). Un archivo `.env.local` en tu computadora no configura Vercel.

Si ya configuraste `VITE_SUPABASE_ANON_KEY` con la clave pública anon, podés conservarla: la aplicación acepta ese alias. No hace falta agregar la otra variable de clave.

Después de guardar las variables, hacé un **Redeploy**: Vite las incorpora durante la compilación. Usá el preset **Vite**, comando `npm run build`, salida `dist` y rama de producción `main`. El archivo `vercel.json` en la raíz configura el acceso directo a `/admin`.

Para comprobar la autorización, ejecutá esto en el SQL Editor de Supabase:

```sql
select u.id, u.email, o.display_name,
       (o.user_id is not null) as tiene_acceso_al_inventario
from auth.users u
left join public.owner_accounts o on o.user_id = u.id
order by u.created_at desc;
```

Buscá la fila del correo de Zuni. Si `tiene_acceso_al_inventario` es `false`, autorizá su UUID con el `insert` del paso 2. Esta consulta es administrativa: no debe incorporarse al frontend ni compartirse públicamente.

Al abrir `/admin`: «Explorar inventario de ejemplo» indica que faltan ambas variables en el build; formulario de correo y contraseña indica que se configuró la conexión, pero no prueba por sí solo que las claves o permisos sean correctos. El mensaje de cuenta sin acceso indica que falta autorizar el UUID. Entrar, guardar una prenda y verla después de recargar comprueba el flujo completo.

## 4. Qué protege el SQL

- `products`: anónimos y usuarios comunes solo pueden leer prendas visibles y no archivadas. El stock cero sigue visible como agotado.
- `owner_accounts`: cada usuario autenticado solo puede leer su propia autorización; solo SQL administrativo puede conceder o revocar permisos.
- `is_owner()`: devuelve un booleano, sin exponer la lista completa de propietarios.
- `adjust_stock(product_id, delta)`: acepta +1 o −1, exige propietario y actualiza de forma atómica, sin permitir stock negativo. La respuesta es la fila actualizada.
- Escrituras de productos y objetos de Storage: solo propietarios autorizados.
- Bucket `product-images`: público para servir las fotografías del catálogo; únicamente admite `image/webp` y hasta 2 MiB por archivo. El cliente convierte y reduce imágenes antes de enviarlas. Los límites también se aplican en Storage.
- Las fotografías subidas son públicas por URL, incluso si luego archivás u ocultás una prenda. No subas imágenes privadas a este bucket. Ocultar una prenda limita su fila en el catálogo; no vuelve privada una foto que ya tuvo una URL pública.
- El permiso por propietario se comprueba en PostgreSQL. Los controles de la interfaz son una ayuda de uso, no el límite de seguridad.

## 5. Validación del proyecto real

Con el SQL aplicado y la app conectada:

1. Sin iniciar sesión: ver catálogo; intentar abrir el inventario y confirmar que pide acceso.
2. Con un usuario sin fila en `owner_accounts`: confirmar el rechazo de administración y de escritura desde la API.
3. Con la cuenta autorizada: crear una prenda, subir JPEG/PNG, confirmar que Storage contiene WebP y revisar su tamaño; recargar para comprobar persistencia.
4. Editar, cambiar stock, ocultar, archivar y restaurar; verificar que el catálogo público refleja cada estado.
5. Exportar CSV y verificar que sus filas corresponden al inventario esperado.
6. Intentar stock negativo y SKU duplicado: deben rechazarse y mostrar error sin afirmar que se guardaron.
7. Cerrar sesión y volver a comprobar que no hay acceso de edición.

La validación local del SQL con PostgreSQL embebido usa esquemas `auth`/`storage` simulados; comprueba las políticas, restricciones y funciones, pero no reemplaza estos pasos ni verifica el servicio remoto de Storage/Auth.

## Repetir las pruebas locales del SQL

No necesitan un proyecto remoto ni claves. Instalan el motor PostgreSQL embebido PGlite en una carpeta temporal, fuera del repositorio:

```sh
npm install --prefix /tmp/eb-sql-validation --cache /tmp/eb-npm-cache --no-audit --no-fund @electric-sql/pglite
PGLITE_MODULE=/tmp/eb-sql-validation/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/validate.mjs
```

La prueba crea una base efímera, aplica el esquema dos veces y comprueba permisos de anónimo, usuario común y propietario, visibilidad, restricciones de datos, ajustes de stock y políticas de objetos. El límite de tamaño/MIME se comprueba en la configuración del bucket; enviar un archivo al servicio real sigue pendiente hasta conectar Supabase.
