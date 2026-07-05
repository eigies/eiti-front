# Users Grid Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alinear encabezados y contenido de la grilla de usuarios sobre los mismos ejes visuales.

**Architecture:** El componente conserva su grilla y markup actuales. El cambio se limita a reglas CSS de escritorio y a una prueba de estilos computados; el breakpoint de tarjetas restablece la alineación izquierda existente.

**Tech Stack:** Angular, CSS Grid, Jasmine, Karma.

---

### Task 1: Alinear columnas de escritorio

**Files:**
- Modify: `src/app/features/users/components/user-access-list/user-access-list.component.css`
- Test: `src/app/features/users/components/user-access-list/user-access-list.component.spec.ts`

- [ ] **Step 1: Escribir la prueba que falla**

Agregar a la prueba de estructura de escritorio:

```ts
const headings = head.querySelectorAll(':scope > span');
const profileCell = row.querySelector('.user-list__profile') as HTMLElement;
const accessCell = row.querySelector('.user-list__access') as HTMLElement;
const stateCell = row.querySelector('.user-list__state') as HTMLElement;
const actionsCell = row.querySelector('.user-list__actions') as HTMLElement;

for (const heading of Array.from(headings).slice(1)) {
  expect(getComputedStyle(heading).textAlign).toBe('center');
}
expect(getComputedStyle(profileCell).textAlign).toBe('center');
expect(getComputedStyle(accessCell).textAlign).toBe('center');
expect(getComputedStyle(stateCell).justifyContent).toBe('center');
expect(getComputedStyle(actionsCell).justifyContent).toBe('center');
```

- [ ] **Step 2: Ejecutar la prueba y comprobar que falla**

Run:

```powershell
npm test -- --no-watch --browsers=ChromeHeadless --include=src/app/features/users/components/user-access-list/user-access-list.component.spec.ts
```

Expected: FAIL porque las columnas de escritorio todavía usan alineaciones diferentes.

- [ ] **Step 3: Implementar la alineación mínima**

Agregar:

```css
.user-list__head > span:not(:first-child),
.user-list__profile,
.user-list__access {
  text-align: center;
}

.user-list__state {
  display: flex;
  justify-content: center;
}

.user-list__actions {
  justify-content: center;
}
```

Dentro de `@container (max-width: 900px)`, restablecer las tarjetas:

```css
.user-list__profile,
.user-list__access {
  text-align: left;
}

.user-list__state {
  display: block;
}
```

- [ ] **Step 4: Ejecutar prueba y build**

Run:

```powershell
npm test -- --no-watch --browsers=ChromeHeadless --include=src/app/features/users/components/user-access-list/user-access-list.component.spec.ts
npm run build
```

Expected: pruebas y build con exit code 0.

- [ ] **Step 5: Verificar visualmente y confirmar que no haya overflow**

Abrir `http://127.0.0.1:4200/users` en escritorio. Confirmar ejes compartidos entre encabezados y celdas, y `scrollWidth <= clientWidth`.

- [ ] **Step 6: Commit**

```powershell
git add src/app/features/users/components/user-access-list/user-access-list.component.css src/app/features/users/components/user-access-list/user-access-list.component.spec.ts
git commit -m "style(users): align user grid columns"
```
