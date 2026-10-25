# Inspección de referencia — Eterna Belleza

Fecha: 2026-10-25. Fuente: https://terramoda-enc-demo.cometbook5.chatgpt.site/.

## Alcance de la inspección

Se inspeccionaron el HTML, CSS, JavaScript, respuesta del catálogo y pantalla pública de acceso `/admin`, descargados mediante HTTPS con verificación TLS. El dominio estuvo inicialmente bloqueado por el proxy (403); después de añadirlo al borrador del entorno, la descarga funcionó.

Para revisar el aspecto y los controles se renderizó con Chromium una copia temporal local de esos mismos archivos y fotos, incluyendo la respuesta del catálogo. La navegación HTTPS directa de Chromium falló por la cadena de confianza de su almacén de certificados; no se desactivó la verificación TLS. Se capturaron vistas de escritorio 1440 × 1100 y móvil 390 × 844. Las imágenes de revisión permanecen en `/tmp`, fuera del proyecto. No se accedió a una sesión privada de Zuni Bogado ni se intentó iniciar sesión en la demo. El interior del inventario se documentó a partir de las capturas aportadas por el usuario.

## Estructura pública observada, en orden

1. **Franja de anuncio**: «MODA PRE LOVED · ENCARNACIÓN» a la izquierda y envíos a Paraguay a la derecha.
2. **Cabecera**: logo circular + marca y lema; enlaces «La colección», «Nuestra esencia», «Visitanos», «Soy el dueño»; botón «Hablemos». En móvil aparece menú desplegable.
3. **Portada `#inicio`**: epígrafe con punto, título serif «Tu estilo. / Una nueva / historia.», último renglón en cursiva y color secundario; párrafo; CTA al catálogo y enlace a tienda; nota de moda pre loved. A la derecha hay dos fotos verticales superpuestas visualmente mediante tamaños/márgenes distintos, una con arco superior, sello redondo y pie editorial.
4. **Franja de valores**: prendas con personalidad, moda pre loved, envíos a Paraguay, Encarnación; separadores decorativos.
5. **Colección `#coleccion`**: epígrafe, título «Ese look que es para vos.», introducción, filtros en píldoras y contador de resultados. Categorías: Ver todo, Vestidos, Tops, Sport, Pantalones, Otros. Cinco tarjetas en escritorio, dos columnas en móvil. Cada tarjeta tiene foto, etiqueta (Ejemplo/Agotado), flecha, categoría/talle, nombre, precio o consulta y enlace de consulta. Nota final con WhatsApp.
6. **Esencia `#esencia`**: bloque de fondo secundario, símbolo y lema en una mitad; título «La moda sigue. / La historia también.», dos párrafos e Instagram en la otra.
7. **Cómo comprar**: epígrafe «Así de simple», título «Del flechazo a tu placard.» y tres pasos numerados: encontrá tu look, escribinos, elegí cómo recibirlo.
8. **Visita `#visitanos`**: título, ubicación, horario y CTA «Cómo llegar»; tarjeta con imagen de mapa y enlace externo. Dirección y horario de Terramoda no deben trasladarse a Eterna Belleza.
9. **CTA final**: fondo primario, «El flechazo empieza acá.» y botón de WhatsApp.
10. **Pie**: marca/lema, Instagram, WhatsApp, Ubicación, Acceso propietario; copyright y nota de demo/stock.
11. **Elementos persistentes**: botón flotante de WhatsApp; diálogo de detalle de producto.

### Interacciones públicas observadas

- Los filtros se combinan como una selección de categoría única; actualizan `aria-pressed`, tarjetas y contador. Seleccionar Tops muestra Top naranja y Top rojo.
- El catálogo se carga desde `/api/products`; incluye carga, error con reintento y categoría sin resultados. Se recarga al volver a la pestaña.
- Foto y enlace inferior abren un diálogo con imagen, nombre, texto de ayuda, consulta lista para copiar y botón para abrir WhatsApp.
- Cierre con botón, Escape y clic fuera; restaura el foco al disparador. El cuerpo queda sin desplazamiento durante el modal.
- Copiar usa Clipboard API y ofrece selección manual si falla.
- Menú móvil con estado abierto/cerrado; se cierra al elegir enlace. No se observó desbordamiento horizontal a 390 px.
- Enlaces de Instagram, WhatsApp y Maps abren destino externo.

### Datos visuales y medidas

- Fuente de interfaz: Arial/Helvetica; títulos: Georgia/Times New Roman, peso normal, cursivas de énfasis.
- Paleta original: crema `#f8f5eb`, azul `#164356`, verde `#527552`, fondo suave `#e9ecdf`, texto secundario `#697671`, líneas `#d9ddd1`.
- Contenedor máximo 1320 px, ancho `calc(100% - 112px)`; 64 px menos en ancho intermedio y 40 px menos en móvil.
- Cabecera 104 px en escritorio / 84 px en móvil. Título hero hasta 96 px (medido 95.04 px a 1440 px); 68 px en móvil. Títulos secundarios alrededor de 43–48 px / 35–38 px.
- Hero en dos columnas; foto principal 460 px de alto, secundaria 360 px con margen superior de 88 px; aumenta en pantallas mayores a 1500 px. Fotos con radios asimétricos.
- Tarjetas: cinco columnas con separación 18 px, fotos 325 px de alto; dos columnas y fotos de 270 px en móvil.
- Secciones con alrededor de 60–75 px de aire vertical en escritorio y 38–45 px en móvil. Líneas finas; botones rectos; filtros y botón flotante redondeados.
- Breakpoints principales: 1500, 1100, 760 y 370 px; respeta `prefers-reduced-motion`.

### Productos del catálogo de referencia

Vestido tropical (`floral`), Vestido blanco (`blanco`), Top naranja (`naranja`), Look sport (`sport`), Top rojo (`rojo`). El catálogo remoto los presenta como ejemplos, una unidad, talle a confirmar y precio a consultar. Las imágenes de estos ejemplos pertenecen a la demo y no representan inventario real de Eterna Belleza.

## Administración

### Acceso público observado en `/admin`

Pantalla dividida: marca y gran título editorial a la izquierda; regreso a tienda y tarjeta «Espacio del propietario» a la derecha. La demo ofrece «Ingresar con ChatGPT» y explica que solo puede acceder la cuenta autorizada. Esto no concede acceso a esa cuenta en el nuevo proyecto. La nueva versión usará Supabase Auth y autorización por UUID, de acuerdo con el backend solicitado.

### Inventario observado en la captura del usuario

- Barra lateral fija: marca, «Espacio del propietario», «Mi negocio», Inventario con contador, Archivadas con contador, Ver tienda.
- Tarjeta informativa inferior y perfil «Zuni Bogado / Propietario» con salida.
- Barra superior: breadcrumb Administración / Inventario y sincronización.
- Encabezado: epígrafe, título serif «Tu inventario.», descripción y «Nueva prenda».
- Cuatro indicadores: prendas activas, unidades en stock, pocas unidades (1 o 2), agotadas.
- Aviso de productos de ejemplo, independiente del estado de persistencia.
- Tabla con contador/exportación CSV; búsqueda por nombre/código/talle, categoría y estado.
- Columnas: foto y nombre/SKU; categoría/talle; precio o consulta; +/− y stock; visible/oculto; editar/archivar.

### Formulario modal observado en la captura del usuario

Fondo oscurecido y desenfocado; tarjeta centrada de aproximadamente 790 px con cierre superior. Epígrafe, título «Una nueva prenda.», foto vertical y carga/cambio en una columna. Campos: nombre, código/SKU, categoría, talle, precio opcional, stock y casilla de visibilidad. Cancelar y Guardar, con guardado deshabilitado cuando faltan requisitos. Notas: precio vacío significa consultar, stock cero significa agotada; imagen JPG/PNG/WebP.

## Adaptación a Eterna Belleza

- Paleta tomada visualmente del logo aportado: rosa aproximado `#e64c7c`, rosa suave y blanco; corona y destellos.
- Eterna Belleza / online shop; Instagram `eternabellezapy`; ropa americana y brasilera.
- WhatsApp de la imagen aportada: +595 981 917788.
- El logo fue aportado en el chat; no hay archivo descargable en el checkout. Se usa una marca vectorial provisional inspirada en sus colores y motivos, reemplazable por el original.
- Ubicación proporcionada por el usuario: Google Maps «Residencia Benitez Bogado», coordenadas `-27.2820707, -55.8104614`. No se asume un horario de atención.
- Conservar orden de secciones, estructura editorial y funciones, sustituyendo la identidad, ubicación y contactos. Los filtros de búsqueda/disponibilidad y orden son ampliaciones funcionales de esta versión.

## Persistencia y límites

- Sin Supabase configurado: demo local explícita, separada de inventario real. Crear/editar, archivar/restaurar, stock, visibilidad y CSV se pueden revisar localmente.
- Con Supabase: autenticación y lista de dueños por UUID, RLS y permisos de almacenamiento. El nombre visible «Zuni Bogado» no sirve como autorización.
- Imágenes: conversión JPEG/PNG/WebP a WebP antes de persistir, reducción de dimensiones, control de tamaño y errores visibles; no se carga una clave de servicio en frontend.
- Pendientes para producción: proyecto Supabase y ejecución del SQL, usuario Auth y UUID autorizado, URL y clave pública, logo original como archivo y sustitución de ejemplos por prendas reales. Los textos de horarios/envíos se deben confirmar antes de publicarlos como promesas comerciales.
