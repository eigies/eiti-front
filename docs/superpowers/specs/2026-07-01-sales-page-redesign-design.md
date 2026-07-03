# Rediseño de la pantalla de ventas

Fecha: 2026-07-01

Estado: aprobado para planificación

Alcance: `src/app/features/sales/sales-page.component.*` y componentes extraídos de esa pantalla

## Contexto

La ruta `/sales` concentra dos trabajos principales:

1. Cargar una venta rápida.
2. Consultar y operar sobre ventas registradas.

La carga es la tarea prioritaria, pero la gestión debe seguir disponible en la misma ruta. El uso principal es en PC con teclado y mouse; una tablet de 768 px también debe resultar cómoda.

La pantalla actual mezcla alta, edición, filtros, resultados, cobro, transporte, exportaciones y múltiples modales. La plantilla tiene alrededor de 1.000 líneas, los estilos alrededor de 2.800 y la lógica alrededor de 1.800. Esta concentración produce tres problemas perceptibles:

- demasiada información visible al mismo tiempo;
- jerarquía débil entre acciones primarias y secundarias;
- exceso de paneles, bordes, chips, mayúsculas y tipografía monoespaciada con el mismo peso.

## Objetivos

- Dar prioridad visual y operativa a la carga de ventas.
- Separar carga y gestión sin crear rutas nuevas.
- Reducir densidad visual sin eliminar capacidades.
- Mantener las acciones frecuentes a uno o dos clics.
- Conservar borradores y filtros al cambiar de modo.
- Mejorar lectura, foco, navegación por teclado y uso táctil en tablet.
- Reducir el tamaño y las responsabilidades del componente principal.

## Fuera de alcance

- Cambios en API, modelos de dominio o reglas de negocio.
- Rediseño de `/sales/full` o `/sales-cc`.
- Cambios funcionales en cobros, transporte, exportaciones o permisos.
- Sustitución del sistema global de temas.
- Optimización específica para teléfonos; no debe haber regresiones ni desbordes a 375 px, pero PC y tablet son las superficies objetivo.

## Arquitectura de información

`/sales` tendrá dos modos internos:

- **Vender**: modo inicial y prioritario.
- **Gestionar ventas**: filtros, resultados y acciones sobre ventas existentes.

El cambio de modo se realiza mediante pestañas accesibles dentro de la misma ruta. No se agregan rutas hijas. `SalesPageComponent` mantiene `activeMode: 'sell' | 'manage'` y conserva montados ambos espacios de trabajo mediante `[hidden]`, de modo que:

- el formulario y los productos del borrador no se pierdan;
- los filtros, página y resultados de gestión se conserven;
- cambiar de pestaña sea inmediato y no dispare cargas innecesarias.

La pestaña activa debe ser operable con teclado, exponer `role="tablist"`, `role="tab"` y `aria-selected`, y mover el foco de forma predecible.

## Modo Vender

### Estructura

La venta rápida se presenta como tres etapas navegables:

1. Datos de venta.
2. Productos.
3. Cliente y cobro.

Las etapas organizan el contenido, pero no forman un asistente rígido:

- el usuario puede ir a cualquier etapa en cualquier momento;
- cambiar de etapa no fuerza validación ni descarta datos;
- el estado completado, activo o pendiente se ve en el encabezado;
- al confirmar, si existen errores se abre y enfoca la primera etapa inválida.

`/sales/full` continúa disponible como “Venta guiada” secundaria para usuarios que prefieran un flujo estrictamente secuencial.

### Resumen persistente

En desktop, un resumen lateral muestra:

- sucursal;
- canal;
- modalidad de entrega;
- cantidad de productos;
- cliente;
- total;
- siguiente acción contextual.

Entre los datos generales y el total, el resumen muestra una vista previa de hasta tres productos. Cada fila contiene:

- marca y nombre del producto, truncados con elipsis y disponibles completos mediante `title`;
- cantidad con formato `× N`;
- subtotal de la línea.

Si el borrador contiene más de tres productos, aparece `+ N productos más`. Esa acción abre la etapa Productos sin modificar el borrador. Si no hay productos, la vista previa no se renderiza.

La acción muestra “Continuar a productos”, “Continuar al cobro” o “Confirmar venta” según la etapa y el estado del borrador.

En tablet, el resumen se transforma en una barra inferior compacta con `Total · N productos` y la acción principal. Las filas de producto no se muestran en esa barra. La barra no debe cubrir campos ni acciones al final de la página.

### Interacción

- Los valores predeterminados actuales se mantienen.
- La búsqueda y selección de productos conserva su funcionalidad.
- Agregar o eliminar productos actualiza el total y el resumen inmediatamente.
- La confirmación respeta permisos, caja abierta, sobreescritura de caja y todas las validaciones existentes.
- Si falla el guardado o el cobro, el borrador permanece intacto.
- Después de una creación exitosa, el formulario se reinicia como hoy y el usuario recibe confirmación clara.

## Modo Gestionar ventas

### Filtros

Los filtros principales permanecen visibles:

- número de comprobante;
- fecha desde;
- fecha hasta;
- estado;
- acción Filtrar.

Los filtros de transporte, teléfono y dirección permanecen en “Más filtros”. Los filtros activos se muestran como chips removibles sin repetir etiquetas innecesarias. “Limpiar” sólo aparece cuando existe al menos un filtro aplicado.

El estado actual de filtros, tamaño de página y página se conserva al cambiar a Vender y volver.

### Resultados en desktop

Las ventas se muestran como filas escaneables con estas columnas:

- venta: código, fecha, hora y sucursal;
- cliente;
- estado;
- entrega o transporte;
- total;
- acciones.

La fila responde primero qué venta es, en qué estado está y qué necesita ahora. Los chips no anteponen textos como “Estado venta:” o “Estado transporte:” cuando el encabezado de columna ya aporta ese contexto.

Abrir una fila muestra el detalle de productos y canjes sin navegar a otra página. El detalle mantiene su paginación actual.

### Resultados en tablet

A 768 px, cada fila se transforma en una tarjeta compacta. La tarjeta muestra:

- código y cliente;
- fecha y sucursal;
- estado y entrega;
- total;
- acción primaria e iconos frecuentes.

No se comprime la tabla de desktop ni se obliga a desplazamiento horizontal.

## Jerarquía de acciones e iconos

La fila o tarjeta conserva visibles:

- **Cobrar** en ventas pendientes, o **Ver** en ventas cerradas;
- WhatsApp cuando la venta cumple las condiciones actuales;
- Documentos;
- Más acciones.

“Documentos” abre un menú con:

- Excel;
- PDF con importes, sujeto a permiso;
- remito de traslado sin importes.

“Más acciones” agrupa:

- Operación: editar, gestionar transporte y asignar canal.
- Relacionados: cliente, conductor y vehículo cuando existan.
- Riesgo: anular venta, separada visualmente y con confirmación.
- Cuenta corriente, cuando corresponda.

Ninguna capacidad actual desaparece. Las acciones siguen condicionadas por estado y permisos.

Los iconos se normalizan como SVG lineales de `24 × 24`, con el mismo grosor y estilo que la navegación existente. No se agregará una librería. Se reemplazan emojis e imágenes visualmente incompatibles. Los iconos sin texto visible deben tener `aria-label` y `title`; dentro de menús siempre se acompañan con una etiqueta.

## Lenguaje visual

### Tipografía

Se reutilizan las familias existentes:

- `Crimson Pro` para título de página, títulos de sección, nombres y texto de ayuda.
- `DM Mono` para códigos, etiquetas cortas, controles, estados e importes.

Se evita usar `DM Mono` en párrafos y títulos humanos extensos. Las mayúsculas quedan reservadas para etiquetas breves, pestañas y acciones.

### Color

Se mantienen los tokens y temas globales. El rediseño debe funcionar en tema oscuro y claro sin colores de superficie hardcodeados.

El ámbar se reserva para:

- acción primaria;
- pestaña o etapa activa;
- foco;
- total destacado.

Los estados usan colores semánticos:

- verde para éxito o pagado;
- ámbar para pendiente;
- azul para información o transporte en curso;
- rojo para error, anulación o acción destructiva.

Los colores nunca son el único medio para comunicar un estado.

### Superficies y espaciado

- Escala principal de espaciado: 8, 12, 16 y 24 px.
- Altura mínima de controles: 42 px; objetivos táctiles: 44 px cuando sea posible.
- Radio consistente de 8 a 12 px.
- Bordes sólo para separar estructura, no para encerrar cada fragmento de información.
- Sombras discretas sólo en menús, paneles flotantes y resumen persistente.
- Transiciones de 150 a 200 ms para foco, expansión, pestañas y etapas.

## Estados y manejo de errores

- Validaciones de campo aparecen junto al control y explican cómo resolver el problema.
- La confirmación con errores abre la primera etapa inválida y enfoca el primer control inválido.
- Errores generales usan el sistema de toast existente.
- Un fallo de creación, cobro, WhatsApp o transporte no elimina el borrador ni altera la lista de forma optimista.
- Cargas muestran skeletons o filas de reserva con dimensiones estables; no se usa una pantalla vacía que salte al completar.
- El estado vacío diferencia entre “no existen ventas” y “no hay resultados para estos filtros”.
- Acciones destructivas mantienen modal de confirmación.
- Los modales de caja no disponible, caja ajena y sesión obsoleta conservan sus reglas actuales, con foco inicial y retorno de foco al cerrarse.

## Componentes y responsabilidades

El rediseño debe extraer responsabilidades sin introducir estado global:

- `SalesPageComponent`: carga de catálogos, coordinación de mutaciones, permisos y modo activo.
- `QuickSaleWorkspaceComponent`: etapas y formulario de venta rápida.
- `QuickSaleSummaryComponent`: resumen y acción contextual.
- `SalesManagementComponent`: filtros, paginación y listado.
- `SaleListItemComponent`: fila desktop o tarjeta tablet y detalle expandido.
- `SaleActionsMenuComponent`: documentos, acciones secundarias y permisos.

Los nombres y límites anteriores son parte del diseño. `SalesPageComponent` conserva `lineForm`, `filterForm`, el borrador de productos, los catálogos y el resultado paginado. Los componentes hijos reciben formularios y valores derivados mediante entradas, y comunican la intención del usuario mediante eventos explícitos. No se crea un servicio de estado nuevo para esta pantalla.

## Flujo de datos

1. `SalesPageComponent` carga sucursales, estados, productos, cajas y ventas como hoy.
2. El modo Vender recibe catálogos y el formulario; emite eventos para agregar productos, cobrar y confirmar.
3. El resumen deriva sus valores del mismo formulario y borrador, sin estado duplicado. La vista previa recibe elementos derivados con `id`, `label`, `quantity` y `subtotal`; no conoce el tipo interno `DraftItem`.
4. El modo Gestionar recibe ventas, filtros y paginación; emite eventos de filtro, navegación y acciones.
5. Tras una mutación exitosa, el coordinador actualiza o recarga la lista con el comportamiento existente.
6. Los permisos se calculan en el coordinador y también se respetan en cada acción contextual.

## Accesibilidad

- Navegación completa por teclado en pestañas, etapas, menús, filas expandibles y modales.
- Foco visible con contraste suficiente.
- Orden de foco equivalente al orden visual.
- `aria-expanded` para detalles y menús.
- `aria-live` para cambios relevantes de total y confirmaciones no cubiertas por toast.
- Textos y estados con contraste WCAG AA.
- No depender de hover para descubrir acciones.
- Soporte de `prefers-reduced-motion`.

## Estrategia de pruebas

### Unitarias y de componentes

- Vender es el modo inicial.
- Cambiar de modo preserva borrador, productos, filtros y paginación.
- Las etapas son navegables sin validación forzada.
- Confirmar con errores abre y enfoca la primera etapa inválida.
- El resumen refleja cambios en productos, cliente y total.
- El resumen muestra como máximo tres productos y calcula correctamente la cantidad restante.
- `+ N productos más` solicita abrir la etapa Productos.
- Cada estado de venta muestra la acción primaria correcta.
- WhatsApp, documentos, cuenta corriente y Más respetan condiciones y permisos.
- Los menús exponen las mismas acciones existentes.
- Filtrar, limpiar y paginar mantienen el comportamiento actual.
- Errores de creación o cobro conservan el borrador.

### Verificación visual y manual

- Desktop: 1280 y 1920 px.
- Tablet: 768 px en orientación vertical y horizontal.
- Control de regresión: 375 px sin desborde horizontal.
- Tema oscuro y claro.
- Navegación sólo con teclado.
- Contraste, foco, menús, modales y barra inferior de tablet.

## Criterios de aceptación

- `/sales` abre en Vender y permite acceder a Gestionar sin navegar.
- Cambiar de modo no pierde datos ni repite cargas innecesarias.
- La venta rápida muestra una sola etapa de contenido a la vez y un resumen persistente.
- El resumen muestra hasta tres líneas de producto en desktop y el conteo en tablet.
- La gestión no muestra más de cuatro controles de acción permanentes por venta.
- Todas las acciones y permisos actuales siguen disponibles.
- A 768 px no hay tablas comprimidas ni desplazamiento horizontal para el flujo principal.
- Tema claro y oscuro conservan legibilidad y estados.
- Los tests existentes siguen pasando y se agregan pruebas para los comportamientos nuevos.
- No se modifica el contrato con la API.
