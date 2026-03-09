# EITI Frontend

Aplicación web de EITI desarrollada en Angular. Es la interfaz usada por operación para ventas, cajas, usuarios y reportes.

## Utilidad del proyecto
- Centraliza la gestión diaria del negocio desde navegador.
- Consume la API de `eiti.Api` para autenticación, ventas, cajas, usuarios y permisos.
- Genera artefactos de trabajo como exportaciones a PDF/Excel desde la UI.

## Estructura principal
- `src/app`: módulos, páginas, componentes y servicios de negocio.
- `src/assets`: recursos estáticos.
- `angular.json`: configuración de build/serve.

## Scripts principales
- `npm start`: levanta entorno local (`ng serve`).
- `npm run build`: compila la aplicación para producción.
- `npm test`: ejecuta tests unitarios.

## Requisitos
- Node.js 18+
- npm 9+

## Levantar en local
```bash
npm install
npm start
```

La app queda disponible en `http://localhost:4200` (salvo configuración distinta).
