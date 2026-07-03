# Sales Summary Product Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar hasta tres productos del borrador dentro del resumen de venta, con cantidad, subtotal y acceso directo a la etapa Productos.

**Architecture:** `SalesPageComponent` deriva una colección presentacional desde `draftItems`. `QuickSaleSummaryComponent` recibe esa colección, limita la vista a tres elementos y emite un evento cuando el usuario solicita ver los restantes.

**Tech Stack:** Angular 16 standalone components, TypeScript, Jasmine/Karma, CSS custom properties.

---

### Task 1: Product preview model and summary rendering

**Files:**
- Modify: `src/app/features/sales/components/quick-sale-summary/quick-sale-summary.component.ts`
- Modify: `src/app/features/sales/components/quick-sale-summary/quick-sale-summary.component.html`
- Modify: `src/app/features/sales/components/quick-sale-summary/quick-sale-summary.component.css`
- Test: `src/app/features/sales/components/quick-sale-summary/quick-sale-summary.component.spec.ts`

- [x] **Step 1: Write failing component tests**

Add:

```ts
it('shows at most three product rows and the remaining count', () => {
  fixture.componentRef.setInput('items', [
    { id: '1', label: 'Producto 1', quantity: 1, subtotal: 10 },
    { id: '2', label: 'Producto 2', quantity: 2, subtotal: 20 },
    { id: '3', label: 'Producto 3', quantity: 3, subtotal: 30 },
    { id: '4', label: 'Producto 4', quantity: 4, subtotal: 40 },
    { id: '5', label: 'Producto 5', quantity: 5, subtotal: 50 }
  ]);
  fixture.detectChanges();

  expect(fixture.nativeElement.querySelectorAll('.quick-summary__product').length).toBe(3);
  expect(fixture.nativeElement.querySelector('.quick-summary__more').textContent)
    .toContain('+ 2 productos más');
});

it('emits when the user requests the remaining products', () => {
  spyOn(component.productsRequested, 'emit');
  component.requestProducts();
  expect(component.productsRequested.emit).toHaveBeenCalled();
});
```

- [x] **Step 2: Run the focused spec and verify RED**

Run:

```powershell
npm test -- --watch=false --browsers=ChromeHeadless --include="**/quick-sale-summary.component.spec.ts"
```

Expected: compilation fails because `items`, `productsRequested`, and `requestProducts` do not exist.

- [x] **Step 3: Implement the summary API**

Add:

```ts
export interface QuickSaleSummaryItem {
  id: string;
  label: string;
  quantity: number;
  subtotal: number;
}

@Input() items: QuickSaleSummaryItem[] = [];
@Output() productsRequested = new EventEmitter<void>();

get visibleItems(): QuickSaleSummaryItem[] {
  return this.items.slice(0, 3);
}

get hiddenItemCount(): number {
  return Math.max(0, this.items.length - this.visibleItems.length);
}

requestProducts(): void {
  this.productsRequested.emit();
}
```

Render `.quick-summary__products` between details and total only when `items.length > 0`. Each row has label with `title`, `× quantity`, and currency subtotal. Render `.quick-summary__more` only when `hiddenItemCount > 0`.

- [x] **Step 4: Add responsive styling**

Desktop rows use a three-column grid: truncated name, quantity and right-aligned subtotal. Below 980 px, hide the preview and change the total label to include the product count.

- [x] **Step 5: Run the focused spec and verify GREEN**

Expected: all summary tests pass.

### Task 2: Derive preview items from the sale draft

**Files:**
- Modify: `src/app/features/sales/sales-page.component.ts`
- Modify: `src/app/features/sales/sales-page.component.html`
- Test: `src/app/features/sales/sales-page.component.spec.ts`

- [x] **Step 1: Write the failing mapping test**

```ts
it('maps draft products to summary preview items', () => {
  component.draftItems = [{
    product: { id: 'p1', brand: 'Moura', name: 'M20GD' } as any,
    quantity: 2,
    total: 104000
  }];

  expect(component.quickSaleSummaryItems).toEqual([{
    id: 'p1',
    label: 'Moura / M20GD',
    quantity: 2,
    subtotal: 104000
  }]);
});
```

- [x] **Step 2: Run the page spec and verify RED**

Expected: compilation fails because `quickSaleSummaryItems` does not exist.

- [x] **Step 3: Implement mapping and wiring**

Add the getter:

```ts
get quickSaleSummaryItems(): QuickSaleSummaryItem[] {
  return this.draftItems.map(item => ({
    id: item.product.id,
    label: `${item.product.brand} / ${item.product.name}`,
    quantity: item.quantity,
    subtotal: item.total
  }));
}
```

Bind `[items]="quickSaleSummaryItems"` and `(productsRequested)="setActiveCreateStage('products')"` on `<app-quick-sale-summary>`.

- [x] **Step 4: Run focused tests**

Run both summary and page specs. Expected: all pass.

- [x] **Step 5: Run full verification**

```powershell
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
git diff --check
```

Expected: tests and build exit 0; no whitespace errors.

- [ ] **Step 6: Commit**

```powershell
git add docs/superpowers/plans/2026-07-03-sales-summary-product-preview.md src/app/features/sales
git commit -m "feat(sales): preview products in sale summary"
```
