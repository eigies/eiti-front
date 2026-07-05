# Alineación de la grilla de usuarios

## Objetivo

Alinear visualmente los encabezados y valores de la grilla de usuarios sin modificar su densidad, contenido ni comportamiento responsive.

## Diseño aprobado

- La columna **Usuario** conserva alineación izquierda para facilitar la lectura de nombre, email y empleado.
- **Perfil**, **Sucursales**, **Estado** y **Acciones** centran tanto el encabezado como el contenido sobre el mismo eje.
- Los botones de acciones se centran como grupo dentro de su columna.
- El indicador de estado se centra como una unidad, incluyendo su punto de color.
- Se conservan anchos, separación, altura de filas y estilos actuales.

## Responsive

Por debajo de 900 px se mantiene el diseño de tarjetas existente. Las reglas de alineación sólo afectan la grilla de escritorio, donde los encabezados son visibles.

## Verificación

- Agregar cobertura de componente para las clases de alineación.
- Ejecutar las pruebas del listado de usuarios.
- Verificar visualmente la grilla en escritorio y confirmar que no haya overflow.
