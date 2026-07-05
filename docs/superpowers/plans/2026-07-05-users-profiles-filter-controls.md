# Users and Profiles Filter Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Usar los selectores reales de la aplicación en los filtros, mostrar inactivos en rojo y eliminar contadores de los tabs.

**Architecture:** Los dos componentes de catálogo reutilizan `SearchableSelectComponent` como control CVA y exponen opciones tipadas derivadas de sus inputs. La lógica de filtrado existente no cambia; sólo cambia la representación y los eventos de los controles. El shell simplifica el contenido visible de los tabs.

**Tech Stack:** Angular standalone components, FormsModule, SearchableSelectComponent, Jasmine, Karma, CSS.

---

### Task 1: Migrar filtros de Usuarios

**Files:**
- Modify: `src/app/features/users/components/user-access-list/user-access-list.component.ts`
- Modify: `src/app/features/users/components/user-access-list/user-access-list.component.html`
- Modify: `src/app/features/users/components/user-access-list/user-access-list.component.css`
- Test: `src/app/features/users/components/user-access-list/user-access-list.component.spec.ts`

- [ ] **Step 1: Escribir pruebas que fallen**

Agregar `By` y `SearchableSelectComponent` al spec. Comprobar que existen tres selectores, no existen `<select>` nativos, sus opciones incluyen los valores globales y elegir `inactive` actualiza el filtro:

```ts
const selectors = fixture.debugElement.queryAll(By.directive(SearchableSelectComponent));
expect(selectors.length).toBe(3);
expect(fixture.nativeElement.querySelector('select')).toBeNull();

const status = selectors[0].componentInstance as SearchableSelectComponent;
expect(status.options.map(option => option.value)).toEqual(['all', 'active', 'inactive']);
status.selectOption(status.options[2]);
expect(component.filters.status).toBe('inactive');
```

Comprobar también que el trigger tiene al menos 44 px y que el estado inactivo usa la clase roja.

- [ ] **Step 2: Ejecutar el spec y verificar RED**

```powershell
npm test -- --no-watch --browsers=ChromeHeadless --include=src/app/features/users/components/user-access-list/user-access-list.component.spec.ts
```

Expected: FAIL porque todavía hay tres `<select>` nativos.

- [ ] **Step 3: Implementar opciones y controles**

Importar:

```ts
import {
  SearchableSelectComponent,
  SearchableSelectOption
} from '../../../../shared/components/searchable-select/searchable-select.component';
```

Agregar `SearchableSelectComponent` a `imports`, opciones estáticas de estado y getters:

```ts
readonly statusFilterOptions: SearchableSelectOption[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' }
];

get profileFilterOptions(): SearchableSelectOption[] {
  return [
    { value: '', label: 'Todos' },
    ...this.profiles.map(profile => ({ value: profile.id, label: profile.name }))
  ];
}

get branchFilterOptions(): SearchableSelectOption[] {
  return [
    { value: '', label: 'Todas' },
    ...this.branches.map(branch => ({ value: branch.id, label: branch.name }))
  ];
}
```

Reemplazar cada `<select>` por `app-searchable-select` con `[ngModel]`, `(ngModelChange)`, opciones, `ariaLabel` y textos de búsqueda específicos.

Agregar:

```css
:host ::ng-deep .user-list__filter .search-select__trigger {
  min-height: 44px;
}

.user-list__status--inactive {
  color: var(--danger);
}

.user-list__status--inactive::before {
  border: 0;
  background: var(--danger);
}
```

- [ ] **Step 4: Ejecutar el spec y verificar GREEN**

Ejecutar el comando del Step 2. Expected: 0 failures.

- [ ] **Step 5: Commit**

```powershell
git add src/app/features/users/components/user-access-list
git commit -m "style(users): use app filters and red inactive state"
```

### Task 2: Migrar filtros de Perfiles y simplificar tabs

**Files:**
- Modify: `src/app/features/users/components/access-profile-list/access-profile-list.component.ts`
- Modify: `src/app/features/users/components/access-profile-list/access-profile-list.component.html`
- Modify: `src/app/features/users/components/access-profile-list/access-profile-list.component.css`
- Modify: `src/app/features/users/users.component.html`
- Test: `src/app/features/users/components/access-profile-list/access-profile-list.component.spec.ts`
- Test: `src/app/features/users/users.component.spec.ts`

- [ ] **Step 1: Escribir pruebas que fallen**

En Perfiles comprobar dos `SearchableSelectComponent`, ningún `<select>` nativo y selección funcional de `custom`. En el shell cambiar la expectativa exacta:

```ts
expect(tabs.map(tab => tab.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
  'Usuarios',
  'Perfiles'
]);
```

- [ ] **Step 2: Ejecutar ambos specs y verificar RED**

```powershell
npm test -- --no-watch --browsers=ChromeHeadless --include=src/app/features/users/components/access-profile-list/access-profile-list.component.spec.ts --include=src/app/features/users/users.component.spec.ts
```

Expected: FAIL por los selects nativos y los contadores visibles.

- [ ] **Step 3: Implementar Perfiles y tabs**

Importar `SearchableSelectComponent` y `SearchableSelectOption`, añadir el componente a `imports` y declarar:

```ts
readonly typeFilterOptions: SearchableSelectOption[] = [
  { value: 'all', label: 'Todos' },
  { value: 'system', label: 'Sistema' },
  { value: 'custom', label: 'Personalizados' }
];

readonly usageFilterOptions: SearchableSelectOption[] = [
  { value: 'all', label: 'Todos' },
  { value: 'used', label: 'Asignados' },
  { value: 'unused', label: 'Sin usuarios' }
];
```

Reemplazar ambos `<select>` por `app-searchable-select`, asegurar trigger de 44 px y dejar el contenido de los tabs en:

```html
Usuarios
```

```html
Perfiles
```

- [ ] **Step 4: Ejecutar specs y verificar GREEN**

Ejecutar el comando del Step 2. Expected: 0 failures.

- [ ] **Step 5: Commit**

```powershell
git add src/app/features/users/components/access-profile-list src/app/features/users/users.component.html src/app/features/users/users.component.spec.ts
git commit -m "style(users): align profile filters and simplify tabs"
```

### Task 3: Verificación integral

**Files:**
- Verify only.

- [ ] **Step 1: Ejecutar suite completa**

```powershell
npm test -- --no-watch --browsers=ChromeHeadless
```

Expected: 0 failures.

- [ ] **Step 2: Ejecutar build**

```powershell
npm run build
```

Expected: exit code 0; se aceptan únicamente warnings preexistentes.

- [ ] **Step 3: Revisar visualmente**

En `http://127.0.0.1:4200/users`, verificar desktop y 375 px: paneles desplegables sin overflow, inactivo rojo, tabs sin números y ausencia de errores de consola.
