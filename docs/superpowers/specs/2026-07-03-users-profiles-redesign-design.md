# Rediseño de Usuarios y Perfiles

Fecha: 2026-07-03

Estado: aprobado para planificación

Alcance: `src/app/features/users/**`

## Contexto

La pantalla actual reúne dos trabajos relacionados pero distintos:

1. Administrar usuarios, su estado, perfil y alcance por sucursal.
2. Administrar perfiles reutilizables y su matriz de permisos.

Ambos trabajos están separados mediante pestañas, pero cada pestaña vuelve a mostrar encabezados, estadísticas, formularios y listados con el mismo peso. En Usuarios, el alta ocupa permanentemente una columna completa aunque la tarea principal es buscar y modificar personas existentes. En Perfiles, el editor, los filtros, el resumen de selección, la matriz de permisos y el catálogo aparecen al mismo tiempo.

La consecuencia es una pantalla densa que exige conocer previamente el modelo de seguridad. La interfaz tampoco explica con suficiente claridad la relación:

- el perfil define **qué puede hacer** una persona;
- las sucursales definen **dónde puede operar**;
- el estado define **si puede acceder**.

## Objetivos

- Priorizar la consulta y edición de registros existentes.
- Separar exploración y edición sin crear rutas nuevas.
- Hacer visible el modelo perfil, sucursales y estado.
- Evitar códigos técnicos de permisos en la vista inicial.
- Mantener altas y cambios frecuentes a uno o dos clics.
- Conservar todas las reglas, permisos y servicios actuales.
- Mejorar uso con teclado, lectura y operación en tablet.
- Dividir el componente actual en unidades con responsabilidades claras.

## Fuera de alcance

- Cambios de API o modelos de dominio.
- Edición de username, email, password o empleado en usuarios existentes, porque la API actual no expone esas operaciones.
- Nuevas reglas para perfiles del sistema.
- Auditoría de cambios de perfil.
- Rediseño de otras pantallas de seguridad, caja o empleados.
- Paginación remota; los datos actuales se filtran en memoria.

## Arquitectura de información

La página conserva una sola ruta y dos pestañas:

- **Usuarios**: sección inicial y prioritaria.
- **Perfiles**: catálogo de perfiles reutilizables.

Se elimina la doble navegación formada por tarjetas ABM más un encabezado de workspace. La nueva cabecera contiene:

- título y descripción breve;
- total correspondiente a la pestaña activa;
- acción contextual `Nuevo usuario` o `Nuevo perfil`;
- pestañas accesibles para cambiar de sección.

Cada pestaña conserva búsqueda, filtros, selección y posición de scroll al cambiar de sección. Los formularios no ocupan espacio hasta que el usuario crea o selecciona un registro.

## Usuarios

### Listado principal

Desktop utiliza una tabla escaneable con:

- usuario: username, email y empleado vinculado cuando exista;
- perfil asignado;
- alcance por sucursal;
- estado;
- acciones.

El toolbar incluye:

- búsqueda por username, email o empleado;
- estado: todos, activos o inactivos;
- perfil;
- sucursal;
- limpieza de filtros sólo cuando exista alguno activo.

Las sucursales se resumen como `Todas`, nombre único o `N sucursales`. No se despliega la grilla completa en cada fila.

Seleccionar una fila abre el panel contextual. El menú de acciones también ofrece editar, activar o desactivar. Activar y desactivar mantienen el comportamiento actual y requieren confirmación cuando la acción reduce acceso.

### Panel de usuario existente

El panel muestra la identidad como contexto de sólo lectura y permite editar:

- perfil de acceso;
- sucursales habilitadas.

El modelo se explica dentro del panel:

- `Perfil de acceso`: qué operaciones recibe la persona.
- `Sucursales`: dónde puede realizarlas.

Los permisos heredados se resumen por cantidad y módulo. `Ver detalle` expande etiquetas humanas y descripciones; los códigos internos no forman parte de la presentación normal.

El pie es fijo y contiene `Cancelar` y `Guardar cambios`. Cerrar o seleccionar otra persona con cambios sin guardar solicita confirmación. Un error conserva el panel y todos los valores ingresados.

### Alta de usuario

`Nuevo usuario` abre el mismo panel en modo creación. Contiene:

- username;
- email;
- password inicial;
- perfil;
- sucursales.

La selección vacía de sucursales mantiene la semántica actual de acceso a todas. La interfaz lo comunica como una opción explícita `Todas las sucursales`, sin depender de interpretar una lista vacía.

El resumen de permisos permanece colapsado. Después de crear, se cierra el panel, se actualiza el listado y se enfoca el usuario nuevo.

## Perfiles

### Catálogo principal

Desktop utiliza una tabla con:

- nombre y descripción;
- tipo actual, del sistema o personalizado;
- cantidad de permisos;
- cantidad de usuarios asignados, derivada de `users`;
- acciones.

El toolbar incluye:

- búsqueda por nombre o descripción;
- tipo: todos, sistema o personalizados;
- uso: todos, asignados o sin usuarios.

Seleccionar una fila abre el panel contextual. Las capacidades de editar y eliminar siguen sujetas al comportamiento y permisos actuales; no se inventan restricciones locales nuevas.

### Panel de perfil

El panel es más ancho que el de Usuarios porque contiene:

- nombre;
- descripción;
- cantidad de usuarios afectados;
- matriz de permisos.

La matriz elimina el filtro redundante por categorías. Los propios módulos son la navegación:

- cada módulo inicia colapsado;
- el encabezado muestra `N de M seleccionados`;
- se puede seleccionar o limpiar el módulo;
- al expandir, cada permiso muestra nombre humano y descripción;
- un buscador filtra permisos por nombre o descripción;
- `Sólo seleccionados` permite revisar el resultado;
- los códigos internos no se muestran.

El pie fijo contiene cancelar y guardar. Al guardar un perfil utilizado, la cantidad de usuarios afectados permanece visible para comunicar el alcance del cambio. Los errores conservan el formulario y selección.

`Nuevo perfil` reutiliza el panel vacío. Eliminar mantiene confirmación destructiva y no modifica el catálogo de forma optimista.

## Panel contextual

En desktop el panel aparece desde la derecha:

- ancho aproximado de 440 px para Usuarios;
- ancho aproximado de 560 px para Perfiles;
- cabecera y pie fijos;
- cuerpo con scroll independiente;
- cierre con botón, `Escape` y retorno de foco al disparador;
- bloqueo de cierre accidental cuando existan cambios.

El listado permanece visible detrás y conserva su estado. Sólo puede existir un panel abierto.

## Responsive

### Tablet

A 768 px:

- la tabla se transforma en tarjetas compactas;
- búsqueda y filtros pueden ocupar dos filas;
- el panel se presenta como sheet de ancho completo;
- botones y opciones mantienen objetivos táctiles de al menos 44 px;
- la matriz de permisos usa un módulo por fila.

### Teléfono

A 375 px no se busca optimización específica, pero no debe existir scroll horizontal ni contenido cortado. Filtros, acciones y pie del panel se apilan cuando sea necesario.

## Lenguaje visual

Se mantiene la dirección editorial existente:

- `Crimson Pro` para títulos, nombres y texto humano;
- `DM Mono` para etiquetas, estados, códigos y acciones breves;
- ámbar para pestaña activa, foco y acción primaria;
- verde para activo;
- rojo sólo para desactivar, eliminar y errores.

Se reduce el número de paneles anidados, bordes, chips y textos en mayúsculas. Las estadísticas sólo aparecen cuando ayudan a decidir; no se repiten en cabecera, workspace y tarjetas.

## Componentes

`UsersComponent` conserva coordinación, carga y mutaciones. La presentación se divide en componentes standalone:

- `UserAccessListComponent`: filtros, tabla o tarjetas y selección de usuarios.
- `UserAccessPanelComponent`: alta y edición de perfil y sucursales.
- `AccessProfileListComponent`: filtros, catálogo y selección de perfiles.
- `AccessProfilePanelComponent`: alta y edición de perfiles.
- `PermissionMatrixComponent`: búsqueda, módulos y selección de permisos.

Los componentes reciben datos y estados mediante entradas y emiten intenciones mediante eventos. No se agrega un servicio de estado global.

## Flujo de datos

1. `UsersComponent` carga usuarios, perfiles y sucursales con los servicios actuales.
2. El listado deriva resultados filtrados sin mutar las colecciones originales.
3. Seleccionar o crear abre un panel con un borrador independiente.
4. Guardar emite un request usando los métodos actuales.
5. En éxito, el coordinador actualiza la colección y cierra el panel.
6. En error, el borrador permanece y se usa el sistema de toast existente.
7. La cantidad de usuarios por perfil se deriva de `users`, sin una llamada nueva.
8. Un perfil actualizado refresca permisos del usuario autenticado y usuarios como hoy.

## Estados y errores

- Carga inicial: skeletons con dimensiones estables.
- Sin registros: mensaje y acción contextual de alta.
- Sin resultados: mensaje distinto y acción para limpiar filtros.
- Guardado: deshabilita sólo el panel activo y muestra progreso en la acción.
- Error de carga: conserva la sección y ofrece reintento.
- Error de mutación: mantiene panel, foco y valores.
- Cambios sin guardar: confirmación antes de cerrar, cambiar de registro o pestaña.
- Eliminación y desactivación: confirmación explícita.

## Accesibilidad

- Pestañas con `role="tablist"`, `role="tab"` y `aria-selected`.
- Panel con nombre accesible, foco inicial y retorno de foco.
- `Escape` cierra únicamente cuando no hay cambios o después de confirmar.
- Orden de foco equivalente al orden visual.
- Filas y tarjetas no dependen sólo del click del contenedor; incluyen una acción accesible.
- Estados no dependen sólo del color.
- Controles sin texto visible tienen `aria-label` y `title`.
- Soporte de `prefers-reduced-motion`.

## Pruebas y criterios de aceptación

- La página abre en Usuarios con el listado como contenido principal.
- El alta no se renderiza permanentemente.
- Búsqueda y filtros de Usuarios se combinan y se pueden limpiar.
- Seleccionar un usuario abre el panel con perfil y sucursales correctos.
- Guardar usa los servicios existentes y un error no descarta cambios.
- Cambiar de pestaña conserva filtros y selección.
- Perfiles muestra cantidad de usuarios asignados.
- La matriz agrupa permisos por módulo y no muestra códigos técnicos.
- Crear y editar reutilizan el mismo panel en cada sección.
- Cerrar con cambios solicita confirmación.
- A 768 px el listado usa tarjetas y el panel ocupa la pantalla.
- A 375 px no existe desborde horizontal.
- Las pruebas existentes y el build continúan pasando.

## Estrategia Git

El trabajo se realiza en el worktree existente:

`C:\EiTeFront\eiti-front\.worktrees\sales-page-redesign`

La rama es `feature/users-profiles-redesign`, creada desde `develop`. La rama anterior `feature/sales-page-redesign` permanece intacta y ya está integrada en `develop`.
