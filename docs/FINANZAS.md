# Actualización: códigos automáticos y finanzas

Esta actualización conserva los productos, fotos, usuarios y autorizaciones existentes. No crea otra base ni requiere volver a crear a Zuni Bogado.

## Aplicar el SQL en Supabase

Si la tienda ya funciona con Supabase, abrí su **SQL Editor → New query**, pegá el archivo completo [`supabase/migrations/20261026_inventory_finance.sql`](../supabase/migrations/20261026_inventory_finance.sql) y presioná **Run**. Podés ejecutarlo otra vez: no borra datos ni reinicia la numeración.

En un proyecto vacío, ejecutá primero [`supabase/schema.sql`](../supabase/schema.sql) y después esta migración. La autorización del dueño sigue siendo la de `owner_accounts` explicada en [SUPABASE.md](SUPABASE.md).

Antes de poner en producción la nueva interfaz, aplicá la migración. La interfaz requiere las tablas y funciones nuevas. Si falta el SQL, el panel debe mostrar un error de actualización pendiente, en lugar de inventar datos o indicar un guardado correcto.

## Códigos de prendas

Las nuevas prendas reciben `EB-0001`, `EB-0002`, etc. al guardarse. La base controla la secuencia y la unicidad, incluso si hay varios equipos cargando. Los códigos anteriores se conservan y no se pueden cambiar desde la aplicación. Si ya existe un código `EB-0027`, la secuencia nueva continúa después del mayor existente. Después de `EB-9999` sigue `EB-10000`.

La numeración puede tener saltos cuando se cancela una transacción o se elimina una prenda. Es correcto: un código identifica una prenda, no cuenta cuántas prendas existen. No reinicies la secuencia ni asignes códigos manualmente.

Las categorías nuevas son Shorts, Blazers, Camisas e Infantiles, además de las anteriores.

## Precio de compra privado

`products` contiene únicamente información de catálogo. El costo de compra se almacena en `product_costs`, con permisos de lectura exclusivos del dueño. No se entrega al visitante y las ventas/gastos tampoco son públicos. Ocultarlo únicamente con CSS no sería suficiente; la protección se aplica en PostgreSQL mediante RLS.

El precio de compra corresponde a **una unidad**. Un valor vacío significa costo desconocido; `0` significa que la unidad no tuvo costo. Las prendas ya cargadas empiezan sin costo conocido: completalo al editarlas antes de registrar su primera venta. El guardado de la prenda y su costo se realiza en una sola transacción.

## Ventas y ganancias

Registrá las ventas desde el panel con prenda, cantidad, precio cobrado por unidad, fecha y medio de pago (Efectivo o Transferencia). Una venta descuenta unidades de stock. El stock no puede quedar negativo. Reintentar la misma solicitud no duplica la venta ni vuelve a descontar stock.

Los botones de ajuste manual de stock sirven para correcciones, pérdidas o reposiciones: **no generan ingresos ni ventas**.

El resumen usa la fecha elegida para la venta/gasto, en meses de calendario:

```text
Ingresos = suma de cantidad × precio cobrado por unidad
Costo vendido = suma de cantidad × precio de compra al vender
Ganancia bruta = ingresos − costo vendido
Ganancia neta = ingresos − costo vendido − otros gastos del mes
```

La venta conserva una copia del costo y precio de ese momento. Si después cambia el costo o el precio de la prenda, las ganancias de meses anteriores no se recalculan con el valor nuevo.

No vuelvas a cargar la compra de la misma prenda como «otro gasto»: su costo ya se descuenta al venderla. Los gastos son, por ejemplo, alquiler, transporte, bolsas, publicidad o servicios. Las unidades todavía sin vender forman parte del inventario; el resumen mide utilidad por ventas, no saldo de caja ni flujo de efectivo.

Una venta anulada se conserva en el historial, se excluye del resultado del mes original y devuelve sus unidades al stock una sola vez. Para corregir una venta, anulala y cargala de nuevo. La anulación no registra un reembolso bancario ni un movimiento de caja independiente.

## Tablas y operaciones nuevas

- `product_costs`: costo unitario privado por producto.
- `sales`: ventas con costo/precio histórico, fecha, pago e identificador de reintento.
- `expenses`: gastos con descripción, categoría, importe y fecha.
- `save_inventory_product`: guarda producto y costo privado de forma atómica.
- `record_sale`: registra venta y descuenta stock en una sola operación.
- `void_sale`: anula una venta y restaura stock de forma idempotente.

Solo el dueño puede ejecutar estas operaciones. Las ventas no se pueden editar/borrar directamente desde la API; el historial se modifica mediante la anulación controlada.

## Netlify

Conservá las variables públicas `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (o `VITE_SUPABASE_PUBLISHABLE_KEY`) y la configuración de `netlify.toml`. No se requieren funciones de Netlify ni claves privadas nuevas: las operaciones protegidas se ejecutan en Supabase. Publicá la nueva versión después de ejecutar el SQL.

## Validación local del SQL

```sh
npm install --prefix /tmp/eb-sql-validation --cache /tmp/eb-npm-cache --no-audit --no-fund @electric-sql/pglite
PGLITE_MODULE=/tmp/eb-sql-validation/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/validate-finance.mjs
```

La prueba aplica la migración sobre la base anterior y la repite. Comprueba conservación de datos, numeración y unicidad, costos privados por RLS, permisos de ventas/gastos, stock, reintentos, costos históricos, anulación y límites mensuales. Auth/Storage se simulan localmente: luego verificá el flujo con tu proyecto Supabase real.
