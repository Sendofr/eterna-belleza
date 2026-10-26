# Eterna Belleza

Tienda, inventario y finanzas de Eterna Belleza, basados en la demo Terramoda y las capturas aportadas. React 19 + TypeScript + Vite; backend Supabase (PostgreSQL, Auth y Storage) y despliegue estático en Netlify. Sin configuración remota puede explorarse una demostración local.

## Actualizar una tienda que ya está funcionando

Antes de publicar la actualización de códigos y finanzas, ejecutá [`supabase/migrations/20261026_inventory_finance.sql`](supabase/migrations/20261026_inventory_finance.sql) en el SQL Editor de tu proyecto Supabase. Conserva los datos y los códigos existentes. La [guía de finanzas](docs/FINANZAS.md) explica el orden de actualización y cómo registrar ventas y gastos. En un proyecto vacío, ejecutá primero `supabase/schema.sql` y luego la migración.

## Probar la web

Requisitos: Node.js 22.12+ o 24 LTS y npm. Se validó con Node 24.19.0 y npm 11.9.0.

```sh
cd /workspace/eterna-belleza
npm ci
npm run dev -- --port 5173
```

Abrí el origen que asigne tu plataforma al servidor de desarrollo. La tienda está en `/` y el acceso de propietario en `/admin`.

Sin variables Supabase, la aplicación muestra un **modo demostración local**. En «Soy el dueño» → «Explorar inventario de ejemplo» podés probar altas, edición, stock, archivo/restauración, filtros, fotos y CSV. Los datos se guardan en el navegador, sin sincronización con otras personas ni acceso al usuario real. No se usan contraseñas ficticias ni se afirma una sesión de Zuni Bogado.

## Conectar tu base de datos

Seguí [la guía de Supabase](docs/SUPABASE.md). El archivo SQL completo está en [`supabase/schema.sql`](supabase/schema.sql).

1. Creá el proyecto y ejecutá `supabase/schema.sql` y después `supabase/migrations/20261026_inventory_finance.sql` en su SQL Editor.
2. Creá tu usuario en Authentication y autorizá su UUID en `owner_accounts`.
3. Copiá `.env.example` a `.env.local` y definí `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (clave pública).
4. Reiniciá el servidor. El modo local desaparece y el inventario real empieza vacío.

No se deben poner claves `service_role`, secretos ni contraseñas en variables `VITE_*`. El SQL usa RLS para que solo las cuentas autorizadas puedan escribir. El nombre visible no concede permisos.

## Qué incluye

- Mismo recorrido público de referencia: cabecera, portada, franja de valores, colección, esencia, tres pasos, ubicación, CTA y pie.
- Catálogo responsive, búsqueda, categorías, disponibilidad, orden, modal de detalle, consulta copiable y enlaces de WhatsApp con prenda/SKU/talle.
- Panel con métricas, búsqueda, filtros, exportación CSV, altas/edición, stock, visibilidad y archivo/restauración.
- Códigos automáticos únicos `EB-0001` en la base de datos, nombre opcional y categorías Shorts, Blazers, Camisas e Infantiles. Los códigos existentes se conservan.
- Precio de compra privado, ventas con descuento automático de stock, gastos y resumen mensual animado de ganancias. El costo histórico se conserva por venta; anular una venta restaura el stock una sola vez.
- Medios de pago Efectivo y Transferencia en cada tarjeta y detalle; Instagram y TikTok de la tienda en el pie.
- Conversión real de JPG/PNG/WebP a WebP en el navegador: lado mayor de hasta 1600 px, compresión y límite de salida de 2 MiB. Entrada máxima de 20 MiB. Storage también restringe MIME y tamaño.
- Estados de carga, catálogo vacío, error/reintento, formularios inválidos, pocas unidades, agotadas y confirmaciones de acciones.
- Ubicación enlazada al punto aportado por el usuario; WhatsApp `+595 981 917788`; Instagram `eternabellezapy`.

## Referencia y ajustes pendientes

La inspección se documenta en [docs/REFERENCIA.md](docs/REFERENCIA.md). Se accedió a la tienda pública y a la pantalla de login, sin acceder a la sesión privada de Terramoda. El inventario se reconstruye desde las capturas del usuario.

Las cinco fotos son las de la demo de referencia, conservadas **solo como muestras**; reemplazalas por las prendas reales antes de publicar el catálogo comercial. El logo aportado en el chat no estuvo disponible como archivo descargable: `public/images/brand.svg` es una marca vectorial provisional con corona y rosa; para usar el original, guardalo en `public/images/` y actualizá las referencias en Brand, Admin, OwnerAccess e index.html según su formato. No se afirma una reproducción exacta del logotipo.

El mapa visual es ilustrativo y está identificado como tal; su enlace abre las coordenadas reales proporcionadas. No se inventan horarios ni opciones de envío: se invita a consultarlos. La autenticación del propietario usa Supabase correo/contraseña, en lugar del proveedor ChatGPT de la demo.

## Comprobaciones

Los resultados y las capturas están en [docs/VALIDACION.md](docs/VALIDACION.md).

```sh
npm run build
npm test
npm run test:e2e
```

Las pruebas de navegador usan Chromium del entorno (`/usr/bin/chromium`); se puede definir `PLAYWRIGHT_CHROMIUM_EXECUTABLE` para otro binario compatible. Consultá `playwright.config.ts`. En una máquina sin navegador instalado, instalá Chromium con `npx playwright install chromium` y ajustá el executablePath.

Las pruebas del esquema y permisos en PostgreSQL embebido se ejecutan con las instrucciones al final de [docs/SUPABASE.md](docs/SUPABASE.md). Los servicios Auth/Storage se simulan en esa validación; la conexión a un proyecto Supabase real no está verificada aún.

## Compilar y desplegar

```sh
npm run build
npm run preview -- --port 4174
```

Publicá `dist/` en un hosting estático con **fallback SPA hacia `/index.html`** para que `/admin` funcione al abrirlo directamente. Incluimos `public/_redirects` para hosts compatibles con ese formato. Definí las variables públicas de Supabase antes de compilar y configurá Site URL en Supabase Auth.

En Netlify, `netlify.toml` establece automáticamente `npm run build` como compilación y `dist` como carpeta publicada. Al importar el repositorio por primera vez, confirmá que use la rama `main` y agregá las variables públicas de Supabase antes de desplegar.

No hace falta un servidor Node de producción para servir la web. Las operaciones protegidas se resuelven mediante Supabase y RLS, no mediante el servidor de Vite. No publiques el catálogo real hasta completar la conexión, la autorización del dueño y las comprobaciones remotas de la guía.
