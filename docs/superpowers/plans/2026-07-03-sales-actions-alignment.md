# Sales Actions Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mantener alineadas las acciones de cada venta reservando la posición de WhatsApp en desktop y reemplazar el dibujo actual por el asset oficial.

**Architecture:** `SaleActionsMenuComponent` conserva toda la lógica existente y agrega un contenedor estable para WhatsApp. El contenedor permanece en desktop aunque no haya acción disponible, se colapsa en tarjetas de hasta 900 px y muestra el SVG de marca existente cuando corresponde.

**Tech Stack:** Angular 16 standalone components, Jasmine/Karma, CSS responsive, SVG estático.

---

### Task 1: Stable WhatsApp action slot

**Files:**
- Modify: `src/app/features/sales/components/sale-actions-menu/sale-actions-menu.component.html`
- Modify: `src/app/features/sales/components/sale-actions-menu/sale-actions-menu.component.css`
- Test: `src/app/features/sales/components/sale-actions-menu/sale-actions-menu.component.spec.ts`

- [x] **Step 1: Write failing component tests**

Add tests that require the WhatsApp position to exist for every row and require the official asset when the action is enabled:

```ts
it('keeps a stable WhatsApp slot when the action is unavailable', () => {
    fixture.componentRef.setInput('canSendWhatsApp', false);
    fixture.detectChanges();

    const slot = fixture.nativeElement.querySelector('[data-slot="whatsapp"]');
    expect(slot).not.toBeNull();
    expect(slot.classList).toContain('is-empty');
    expect(slot.querySelector('[data-action="whatsapp"]')).toBeNull();
});

it('uses the official WhatsApp asset when the action is available', () => {
    fixture.componentRef.setInput('canSendWhatsApp', true);
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector('[data-action="whatsapp"] img');
    expect(icon).not.toBeNull();
    expect(icon.getAttribute('src')).toBe('assets/channels/ch-whatsapp.svg');
});
```

- [x] **Step 2: Run the focused spec and verify RED**

Run:

```powershell
npm test -- --watch=false --browsers=ChromeHeadless --include="**/sale-actions-menu.component.spec.ts"
```

Expected: the stable slot test fails because `[data-slot="whatsapp"]` does not exist, and the asset test fails because the current icon is an inline approximation.

- [x] **Step 3: Add the stable slot and official icon**

Wrap the conditional WhatsApp button in an unconditional slot:

```html
<div
  class="sale-actions__slot sale-actions__slot--whatsapp"
  [class.is-empty]="!canSendWhatsApp"
  data-slot="whatsapp">
  <button
    *ngIf="canSendWhatsApp"
    class="sale-actions__icon sale-actions__icon--whatsapp"
    data-action="whatsapp"
    type="button"
    [disabled]="sendingWhatsApp"
    aria-label="Enviar por WhatsApp"
    title="Enviar por WhatsApp"
    (click)="emitAction('whatsapp', $event)">
    <img src="assets/channels/ch-whatsapp.svg" alt="" aria-hidden="true" />
  </button>
</div>
```

Keep the current flex action bar and reserve exactly `38px`:

```css
.sale-actions__slot {
  display: grid;
  flex: 0 0 38px;
  place-items: center;
  width: 38px;
}

.sale-actions__slot .sale-actions__icon {
  width: 100%;
}

.sale-actions__icon--whatsapp img {
  display: block;
  width: 18px;
  height: 18px;
}

@media (max-width: 900px) {
  .sale-actions__slot.is-empty {
    display: none;
  }
}
```

- [x] **Step 4: Run the focused spec and verify GREEN**

Run the focused spec again. Expected: all `SaleActionsMenuComponent` tests pass.

- [x] **Step 5: Run full verification**

Run:

```powershell
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
git diff --check
```

Expected: all tests and the build exit `0`; no whitespace errors. Existing unrelated build warnings may remain.

- [x] **Step 6: Commit**

```powershell
git add docs/superpowers/plans/2026-07-03-sales-actions-alignment.md src/app/features/sales/components/sale-actions-menu
git commit -m "fix(sales): align sale action controls"
```
