# Sales Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar `/sales` con modos separados para vender y gestionar, carga rápida por etapas, resumen persistente, listado escaneable y acciones jerarquizadas, sin cambiar reglas de negocio ni contratos HTTP.

**Architecture:** `SalesPageComponent` conserva formularios, datos y coordinación. Componentes standalone de presentación reciben valores mediante `@Input()` y emiten intención mediante `@Output()`. La implementación se hace de forma incremental sobre los métodos existentes para reducir riesgo y mantener todas las capacidades actuales.

**Tech Stack:** Angular 16 standalone components, TypeScript 5.1, Reactive Forms, Jasmine/Karma, CSS custom properties.

---

## File map

- Create `src/app/features/sales/components/quick-sale-workspace/quick-sale-workspace.component.{ts,html,css,spec.ts}`: navegación accesible entre las tres etapas.
- Create `src/app/features/sales/components/quick-sale-summary/quick-sale-summary.component.{ts,html,css,spec.ts}`: resumen y acción contextual.
- Create `src/app/features/sales/components/sale-actions-menu/sale-actions-menu.component.{ts,html,css,spec.ts}`: atajos, documentos y menú secundario.
- Create `src/app/features/sales/components/sales-management/sales-management.component.{ts,html,css}`: shell semántico del modo gestión.
- Create `src/app/features/sales/components/sale-list-item/sale-list-item.component.{ts,html,css}`: shell semántico de fila/tarjeta.
- Create `src/app/features/sales/sales-page-ui.models.ts`: tipos compartidos de modo, etapa y acciones.
- Modify `src/app/features/sales/sales-page.component.{ts,html,css,spec.ts}`: estado de UI, composición, filtros, listado, estilos responsive y foco en validación.

### Task 1: Estado de modos y etapas

**Files:**
- Create: `src/app/features/sales/sales-page-ui.models.ts`
- Modify: `src/app/features/sales/sales-page.component.ts`
- Modify: `src/app/features/sales/sales-page.component.spec.ts`

- [ ] **Step 1: Write failing state tests**

Add a `describe('SalesPageComponent (redesign state)')` suite using the existing TestBed setup and assert:

```ts
it('starts in sell mode and configuration stage', () => {
  expect(component.activeMode).toBe('sell');
  expect(component.activeCreateStage).toBe('config');
});

it('switches modes without resetting draft or filters', () => {
  component.draftItems = [{ product: { id: 'p1' } as any, quantity: 1, total: 100 }];
  component.filterForm.patchValue({ code: 'V-42' });

  component.setActiveMode('manage');
  component.setActiveMode('sell');

  expect(component.draftItems.length).toBe(1);
  expect(component.filterForm.get('code')?.value).toBe('V-42');
});

it('moves to the first invalid stage before submit', () => {
  component.activeCreateStage = 'payment';
  component.lineForm.patchValue({ branchId: '', sourceChannel: null });

  component.submit();

  expect(component.activeCreateStage).toBe('config');
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
npm test -- --watch=false --browsers=ChromeHeadless --include="**/sales-page.component.spec.ts"
```

Expected: compilation fails because `activeMode`, `activeCreateStage`, and `setActiveMode` do not exist.

- [ ] **Step 3: Implement state and validation routing**

Create the shared model:

```ts
export type SalesPageMode = 'sell' | 'manage';
export type QuickSaleStage = 'config' | 'products' | 'payment';
```

Import those types in `SalesPageComponent` and add:

```ts

activeMode: SalesPageMode = 'sell';
activeCreateStage: QuickSaleStage = 'config';

setActiveMode(mode: SalesPageMode): void {
  this.activeMode = mode;
}

setActiveCreateStage(stage: QuickSaleStage): void {
  this.activeCreateStage = stage;
}

get isCreateConfigComplete(): boolean {
  return Boolean(this.lineForm.get('branchId')?.valid && this.lineForm.get('sourceChannel')?.valid);
}

get isCreateProductsComplete(): boolean {
  return this.draftItems.length > 0;
}
```

At the start of `submit()`, before returning for invalid branch/channel or no products, set the matching stage:

```ts
if (!this.isCreateConfigComplete) {
  this.activeCreateStage = 'config';
} else if (!this.isCreateProductsComplete) {
  this.activeCreateStage = 'products';
}
```

- [ ] **Step 4: Run the focused test**

Expected: the new state tests and existing price override tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/app/features/sales/sales-page.component.ts src/app/features/sales/sales-page.component.spec.ts
git commit -m "feat(sales): add sales page view state"
```

### Task 2: Quick-sale stage navigation and persistent summary

**Files:**
- Create: `src/app/features/sales/components/quick-sale-workspace/quick-sale-workspace.component.ts`
- Create: `src/app/features/sales/components/quick-sale-workspace/quick-sale-workspace.component.html`
- Create: `src/app/features/sales/components/quick-sale-workspace/quick-sale-workspace.component.css`
- Create: `src/app/features/sales/components/quick-sale-workspace/quick-sale-workspace.component.spec.ts`
- Create: `src/app/features/sales/components/quick-sale-summary/quick-sale-summary.component.ts`
- Create: `src/app/features/sales/components/quick-sale-summary/quick-sale-summary.component.html`
- Create: `src/app/features/sales/components/quick-sale-summary/quick-sale-summary.component.css`
- Create: `src/app/features/sales/components/quick-sale-summary/quick-sale-summary.component.spec.ts`
- Modify: `src/app/features/sales/sales-page.component.{ts,html,css}`

- [ ] **Step 1: Write failing component tests**

For the workspace:

```ts
it('emits the selected stage', () => {
  const emitted: string[] = [];
  component.stageChange.subscribe(value => emitted.push(value));
  component.selectStage('products');
  expect(emitted).toEqual(['products']);
});

it('marks completed and active stages accessibly', () => {
  fixture.componentRef.setInput('activeStage', 'products');
  fixture.componentRef.setInput('configComplete', true);
  fixture.detectChanges();
  const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
  expect(tabs[0].textContent).toContain('Datos de venta');
  expect(tabs[0].classList).toContain('is-complete');
  expect(tabs[1].getAttribute('aria-selected')).toBe('true');
});
```

For the summary:

```ts
it('uses the correct action label for each stage', () => {
  fixture.componentRef.setInput('activeStage', 'products');
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('.quick-summary__action').textContent)
    .toContain('Continuar al cobro');
});

it('emits the primary action', () => {
  spyOn(component.primaryAction, 'emit');
  component.handlePrimaryAction();
  expect(component.primaryAction.emit).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run both specs and verify failure**

Expected: test files fail because the components do not exist.

- [ ] **Step 3: Implement standalone components**

`QuickSaleWorkspaceComponent` inputs:

```ts
@Input({ required: true }) activeStage!: QuickSaleStage;
@Input() configComplete = false;
@Input() productsComplete = false;
@Output() stageChange = new EventEmitter<QuickSaleStage>();
```

Its template renders a `role="tablist"` with three buttons, `aria-selected`, completion classes, and three projected slots named `[quickSaleConfig]`, `[quickSaleProducts]`, and `[quickSalePayment]`. Only the active slot is visible.

`QuickSaleSummaryComponent` inputs:

```ts
@Input({ required: true }) activeStage!: QuickSaleStage;
@Input() branch = 'Sin seleccionar';
@Input() channel = 'Sin seleccionar';
@Input() delivery = 'Retira cliente';
@Input() customer = 'Consumidor final';
@Input() productCount = 0;
@Input() total = 0;
@Input() saving = false;
@Output() primaryAction = new EventEmitter<void>();
```

The action label is derived exactly as:

```ts
get actionLabel(): string {
  if (this.saving) return 'Guardando...';
  if (this.activeStage === 'config') return 'Continuar a productos';
  if (this.activeStage === 'products') return 'Continuar al cobro';
  return 'Confirmar venta';
}
```

- [ ] **Step 4: Integrate existing quick-sale markup**

Import both components in `SalesPageComponent`. Replace the collapsible “Nueva venta rápida” wrapper with the mode tabs and a `.quick-sale-layout`. Move the three existing cards into the matching projection slots without changing their controls or handlers. Connect the summary action to:

```ts
handleQuickSalePrimaryAction(): void {
  if (this.activeCreateStage === 'config') {
    this.activeCreateStage = 'products';
    return;
  }
  if (this.activeCreateStage === 'products') {
    this.activeCreateStage = 'payment';
    return;
  }
  this.submit();
}
```

- [ ] **Step 5: Run workspace, summary, and page specs**

Expected: all focused specs pass.

- [ ] **Step 6: Commit**

```powershell
git add src/app/features/sales/components/quick-sale-workspace src/app/features/sales/components/quick-sale-summary src/app/features/sales/sales-page.component.*
git commit -m "feat(sales): redesign quick sale workspace"
```

### Task 3: Hierarchical sale actions

**Files:**
- Create: `src/app/features/sales/components/sale-actions-menu/sale-actions-menu.component.{ts,html,css,spec.ts}`
- Modify: `src/app/features/sales/sales-page.component.{ts,html,css}`

- [ ] **Step 1: Write failing action-menu tests**

Use a minimal `SaleResponse` fixture and assert:

```ts
it('shows cobrar, WhatsApp, documents and more for an eligible pending sale', () => {
  fixture.componentRef.setInput('sale', pendingSale);
  fixture.componentRef.setInput('canPay', true);
  fixture.componentRef.setInput('canSendWhatsApp', true);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('[data-action="pay"]')).not.toBeNull();
  expect(fixture.nativeElement.querySelector('[data-action="whatsapp"]')).not.toBeNull();
  expect(fixture.nativeElement.querySelector('[data-menu="documents"]')).not.toBeNull();
  expect(fixture.nativeElement.querySelector('[data-menu="more"]')).not.toBeNull();
});

it('emits semantic actions', () => {
  spyOn(component.action, 'emit');
  component.emitAction('edit');
  expect(component.action.emit).toHaveBeenCalledWith('edit');
});

it('hides actions without permission', () => {
  fixture.componentRef.setInput('sale', pendingSale);
  fixture.componentRef.setInput('canPay', false);
  fixture.componentRef.setInput('canEdit', false);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('[data-action="pay"]')).toBeNull();
  expect(fixture.nativeElement.textContent).not.toContain('Editar venta');
});
```

- [ ] **Step 2: Run and verify failure**

Expected: component is missing.

- [ ] **Step 3: Implement the component**

Define:

```ts
export type SaleUiAction =
  | 'details' | 'customer' | 'driver' | 'vehicle' | 'transport'
  | 'channel' | 'excel' | 'pdf' | 'remito' | 'whatsapp'
  | 'account' | 'cancel' | 'edit' | 'pay';
```

Inputs include `sale`, permission booleans, pending state booleans and `canSendWhatsApp`. Output `action` emits `SaleUiAction`. Keep only Pay/View, WhatsApp, Documents and More visible. Menus use inline 24×24 SVG, labels, `aria-expanded`, Escape-to-close, and click-outside close.

- [ ] **Step 4: Replace the existing icon toolbar**

Add `handleSaleUiAction(sale: SaleResponse, action: SaleUiAction, event?: Event)` to dispatch to the existing methods. Replace the current action block in the sale loop with `<app-sale-actions-menu>`.

- [ ] **Step 5: Run focused tests**

Expected: action-menu and sales-page specs pass.

- [ ] **Step 6: Commit**

```powershell
git add src/app/features/sales/components/sale-actions-menu src/app/features/sales/sales-page.component.*
git commit -m "feat(sales): group sale actions by intent"
```

### Task 4: Manage-sales rows, tablet cards, and component boundaries

**Files:**
- Create: `src/app/features/sales/components/sales-management/sales-management.component.{ts,html,css}`
- Create: `src/app/features/sales/components/sale-list-item/sale-list-item.component.{ts,html,css}`
- Modify: `src/app/features/sales/sales-page.component.{ts,html,css,spec.ts}`

- [ ] **Step 1: Write failing page DOM tests**

```ts
it('keeps sell and manage workspaces mounted while hiding the inactive mode', () => {
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('[data-mode-panel="sell"]').hidden).toBeFalse();
  expect(fixture.nativeElement.querySelector('[data-mode-panel="manage"]').hidden).toBeTrue();
  component.setActiveMode('manage');
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('[data-mode-panel="manage"]').hidden).toBeFalse();
});

it('renders management results with desktop row semantics', () => {
  component.sales = [saleFixture];
  component.setActiveMode('manage');
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('[role="row"]')).not.toBeNull();
  expect(fixture.nativeElement.textContent).toContain(saleFixture.code);
});
```

- [ ] **Step 2: Run and verify failure**

Expected: selectors are absent.

- [ ] **Step 3: Implement semantic shell components**

`SalesManagementComponent` exposes projected slots for `[managementFilters]`, `[managementMeta]`, `[managementResults]`, and `[managementPagination]`.

`SaleListItemComponent` uses selector `article[appSaleListItem]`, projects row content and exposes host bindings:

```ts
@HostBinding('class.sale-list-item') readonly itemClass = true;
@HostBinding('attr.role') readonly role = 'row';
@Input() expanded = false;
@HostBinding('attr.aria-expanded') get ariaExpanded(): string {
  return String(this.expanded);
}
```

- [ ] **Step 4: Restructure filters and results**

Move management into the hidden mode panel. Keep primary filters in one row and secondary filters in the existing `<details>`. Render result content as a desktop grid row with code/date/branch, client, state, delivery, total, and the action component. Keep the existing detail table projected below each row.

At `max-width: 900px`, change the item to a card grid, hide the desktop header, retain all essential fields, and ensure action targets are at least 44 px.

- [ ] **Step 5: Run page tests and build**

Expected: specs pass and Angular template compilation succeeds.

- [ ] **Step 6: Commit**

```powershell
git add src/app/features/sales/components/sales-management src/app/features/sales/components/sale-list-item src/app/features/sales/sales-page.component.*
git commit -m "feat(sales): add responsive sales management view"
```

### Task 5: Visual language, accessibility, and feedback states

**Files:**
- Modify: `src/app/features/sales/sales-page.component.{html,css,ts,spec.ts}`
- Modify: component CSS files created in Tasks 2–4

- [ ] **Step 1: Write failing accessibility tests**

```ts
it('exposes accessible mode tabs', () => {
  fixture.detectChanges();
  const tabs = fixture.nativeElement.querySelectorAll('.sales-mode-tabs [role="tab"]');
  expect(tabs.length).toBe(2);
  expect(tabs[0].getAttribute('aria-selected')).toBe('true');
});

it('marks the first invalid field and switches to its stage', () => {
  component.activeCreateStage = 'payment';
  component.lineForm.patchValue({ branchId: '', sourceChannel: null });
  component.submit();
  fixture.detectChanges();
  expect(component.activeCreateStage).toBe('config');
  expect(fixture.nativeElement.querySelector('[aria-invalid="true"]')).not.toBeNull();
});
```

- [ ] **Step 2: Run and verify failure**

Expected: accessible tabs or invalid-state attributes are missing.

- [ ] **Step 3: Apply the approved visual language**

Use `Crimson Pro` for page/section headings and human-readable copy. Restrict `DM Mono` to codes, short labels, controls, states, and amounts. Use existing CSS variables for both themes. Reserve amber for primary action, focus, active tab/stage, and total.

Normalize:

- spacing to 8/12/16/24 px;
- controls to at least 42 px;
- touch targets to 44 px at tablet width;
- radii to 8–12 px;
- transitions to 150–200 ms;
- `:focus-visible` rings;
- `prefers-reduced-motion`.

- [ ] **Step 4: Add stable loading and empty states**

Render fixed-height skeleton rows while `loadingSales`. Use separate messages for zero total sales and zero filtered results. Keep toast behavior and existing cash-session modals.

- [ ] **Step 5: Run focused tests**

Expected: all sales component specs pass.

- [ ] **Step 6: Commit**

```powershell
git add src/app/features/sales
git commit -m "feat(sales): polish accessibility and visual hierarchy"
```

### Task 6: Regression verification

**Files:**
- Modify only if verification reveals a defect.

- [ ] **Step 1: Run sales tests**

```powershell
npm test -- --watch=false --browsers=ChromeHeadless --include="**/sales*.spec.ts"
```

Expected: all sales specs pass.

- [ ] **Step 2: Run lint-equivalent and production build**

```powershell
npm run build
```

Expected: Angular production build succeeds with no template or TypeScript errors.

- [ ] **Step 3: Run repository diff checks**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only intentional implementation files are modified.

- [ ] **Step 4: Verify acceptance criteria manually**

At 1280, 1920, 768 portrait/landscape and 375 px, verify:

- Vender opens by default.
- Switching modes preserves draft and filters.
- Stage navigation is keyboard-operable.
- Summary remains visible without covering content.
- Desktop results are scannable rows; tablet results are cards.
- All permission-gated actions remain available.
- Dark and light themes remain legible.
- No horizontal overflow occurs.

- [ ] **Step 5: Final implementation commit if verification required fixes**

```powershell
git add src/app/features/sales
git commit -m "fix(sales): resolve redesign regressions"
```
