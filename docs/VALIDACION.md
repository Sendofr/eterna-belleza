# Validación de la primera versión

## Actualización de inventario y finanzas — 2026-10-26

- `npm run build`: TypeScript y compilación para Netlify aprobados. No se agregaron dependencias ni funciones de servidor al hosting.
- `npm test`: 50 pruebas aprobadas, incluyendo generación de códigos, migración de demostración previa, costos privados, paginación de más de 1000 registros, errores, transacciones locales y resumen por mes.
- `npm run test:e2e`: 10 pruebas completas aprobadas en Chromium. Cubren altas sin nombre ni SKU, categorías nuevas, pagos, TikTok, WebP, ventas, gastos editables, anulaciones, stock, costos históricos, meses separados y móvil.
- `node supabase/tests/validate-finance.mjs` con `PGLITE_MODULE` configurado: 43 comprobaciones PostgreSQL aprobadas. Incluyen migración repetible, datos previos, numeración después de 9999, privacidad por RLS, guardado atómico, ventas idempotentes y anulaciones.
- Capturas nuevas: [Finanzas escritorio](review/finanzas-desktop.png) y [Finanzas móvil](review/finanzas-mobile.png). Se usaron movimientos ficticios en una sesión de demostración aislada únicamente para mostrar el diseño; no se insertan ganancias de ejemplo en la aplicación ni en Supabase.

El proyecto Supabase remoto sigue sin estar disponible para esta validación. Antes de desplegar esta actualización, ejecutar la migración indicada en [FINANZAS.md](FINANZAS.md). Las pruebas SQL usan PostgreSQL embebido con esquemas Auth/Storage simulados; no prueban credenciales ni conectividad remota.

## Registro de la primera versión

Ejecutada en esta instancia el 2026-10-25 con Node 24.19.0, npm 11.9.0 y Chromium de sistema.

- `npm ci --cache /tmp/eterna-npm-cache --no-audit --no-fund`: instalación repetible con lockfile, correcta.
- `npm run build`: TypeScript y compilación de producción, correctos.
- `npm test`: 37 pruebas aprobadas (inventario, CSV/WhatsApp/precios, configuración pública de Supabase y limpieza de imágenes).
- `npm run test:e2e`: 6 pruebas de navegador aprobadas, escritorio y móvil. Incluyen recorrido del catálogo, filtros/orden, modales/foco, CRUD local, validación, stock/agotadas, ocultar, archivar/restaurar, CSV y persistencia.
- La conversión de PNG se comprobó mediante firma de bytes `RIFF` / `WEBP`, MIME, dimensiones 1600 × 960 a partir de 2000 × 1200 y tamaño inferior a 2 MiB.
- `PGLITE_MODULE=/tmp/eb-sql-validation/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/validate.mjs`: 28 comprobaciones PostgreSQL aprobadas (migración repetible, restricciones, RLS, autorización, stock y políticas Storage). `auth` y `storage` son esquemas simulados.
- Comprobación adicional de autenticación en Chromium con endpoints Supabase simulados: 11 verificaciones sobre dueño autorizado, cuenta sin permisos, error de autorización, persistencia de sesión y cierre de sesión entre pestañas. No se usó una cuenta ni proyecto real.

No se verificó una conexión real a Supabase, entrega remota de correo ni subida al servicio remoto de Storage: el usuario todavía no creó su proyecto. Los pasos para comprobarlos están en [SUPABASE.md](SUPABASE.md).

## Capturas de esta versión

- [Tienda en escritorio](review/tienda-desktop.png)
- [Tienda en móvil](review/tienda-mobile.png)
- [Inventario](review/inventario.png)
- [Formulario de nueva prenda](review/formulario.png)

Las capturas corresponden a ejemplos locales, no a stock real. La marca vectorial es provisional hasta disponer del archivo original del logo.
