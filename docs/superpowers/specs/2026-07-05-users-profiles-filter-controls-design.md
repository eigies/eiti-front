# Controles de filtros y estados de usuarios

## Objetivo

Completar la consistencia visual de Usuarios y Perfiles usando el selector reutilizable de la aplicación y simplificando información secundaria.

## Diseño aprobado

### Filtros

- Reemplazar los `<select>` nativos por `app-searchable-select`.
- Usuarios utiliza el componente en Estado, Perfil y Sucursal.
- Perfiles utiliza el componente en Tipo y Uso.
- Cada selector conserva el valor inicial “Todos” o “Todas” como una opción explícita.
- La selección continúa actualizando los filtros existentes; no cambia la lógica ni los resultados.
- Los campos de búsqueda de Usuarios y Perfiles permanecen como inputs de texto.

### Estado

- “Activo” conserva texto y punto sólido verdes.
- “Inactivo” utiliza texto y punto sólido rojos con la misma geometría.
- El botón Activar/Desactivar no cambia de comportamiento.

### Tabs

- Los tabs muestran únicamente “Usuarios” y “Perfiles”.
- Se eliminan el separador y los contadores.
- Se conservan roles, navegación por teclado y estado activo.

## Responsive y accesibilidad

- Los selectores mantienen ancho completo y altura mínima de 44 px.
- Se conservan nombres accesibles específicos para cada filtro.
- Los paneles desplegables no deben producir overflow horizontal.

## Verificación

- Probar que todos los filtros usan `app-searchable-select` y aplican los valores elegidos.
- Probar que los tabs no incluyen cantidades.
- Probar que el estado inactivo usa la variante roja con punto sólido.
- Ejecutar pruebas de Usuarios, suite completa, build y revisión visual en escritorio y móvil.
