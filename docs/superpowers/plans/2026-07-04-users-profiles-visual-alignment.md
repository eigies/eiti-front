# Users and Profiles Visual Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align both access catalogs with the Profiles visual language and make both contextual editors comfortably wide and spacious.

**Architecture:** Keep component APIs, templates, data flow, and behavior unchanged. Treat `AccessProfileListComponent` as the visual source of truth, align `UserAccessListComponent` to its table/control/action geometry, then apply the same application-control tokens to both catalogs. Increase both isolated panel components to a shared 720px desktop width with relaxed spacing and existing full-width responsive behavior.

**Tech Stack:** Angular 16 standalone components, Jasmine/Karma, component-scoped CSS, CSS container queries.

---

### Task 1: Align the Users catalog with Profiles

**Files:**
- Modify: `src/app/features/users/components/user-access-list/user-access-list.component.spec.ts`
- Modify: `src/app/features/users/components/user-access-list/user-access-list.component.css`

- [ ] **Step 1: Write failing visual-geometry assertions**

Extend the existing desktop structure spec with computed-style assertions:

```ts
const head = fixture.nativeElement.querySelector('.user-list__head') as HTMLElement;
const row = fixture.nativeElement.querySelector('.user-list__row') as HTMLElement;
const edit = fixture.nativeElement.querySelector('.user-list__open') as HTMLButtonElement;

expect(getComputedStyle(head).borderTopWidth).toBe('1px');
expect(getComputedStyle(head).borderTopLeftRadius).toBe('10px');
expect(row.getBoundingClientRect().height).toBeLessThanOrEqual(72);
expect(getComputedStyle(edit).borderTopLeftRadius).toBe('8px');
```

- [ ] **Step 2: Run the focused spec and verify RED**

Run:

```powershell
npm test -- --watch=false --browsers=ChromeHeadless --include="**/user-access-list.component.spec.ts"
```

Expected: failures report the current open table, 92px rows, and square action buttons.

- [ ] **Step 3: Implement matching table and action geometry**

Update the Users table styles to use the same framed structure as Profiles:

```css
.user-list__head,
.user-list__row,
.user-list__skeleton {
  grid-template-columns:
    minmax(190px, 1.35fr)
    minmax(120px, .75fr)
    minmax(110px, .7fr)
    minmax(90px, .55fr)
    minmax(180px, auto);
  gap: .8rem;
}

.user-list__head {
  min-height: 0;
  padding: .65rem .8rem;
  border: 1px solid var(--border);
  border-bottom: 0;
  border-radius: 10px 10px 0 0;
  background: color-mix(in srgb, var(--bg) 76%, var(--bg-panel));
}

.user-list__row {
  min-height: 68px;
  padding: .7rem .8rem;
  border: 1px solid var(--border);
  border-bottom: 0;
  background: color-mix(in srgb, var(--bg-panel) 92%, transparent);
}

.user-list__row:last-of-type {
  border-bottom: 1px solid var(--border);
  border-radius: 0 0 10px 10px;
}

.user-list__create,
.user-list__reload,
.user-list__clear,
.user-list__empty button,
.user-list__open,
.user-list__status-action {
  min-height: 40px;
  padding: .55rem .75rem;
  border-radius: 8px;
  font-size: .68rem;
}
```

Preserve the existing selected stripe, status colors, mobile labels, two-column tablet card, and one-column phone card.

- [ ] **Step 4: Run the focused spec and verify GREEN**

Expected: all User list specs pass.

- [ ] **Step 5: Commit**

```powershell
git add src/app/features/users/components/user-access-list
git commit -m "style(users): align user and profile catalogs"
```

### Task 2: Standardize filter controls in both catalogs

**Files:**
- Modify: `src/app/features/users/components/user-access-list/user-access-list.component.spec.ts`
- Modify: `src/app/features/users/components/access-profile-list/access-profile-list.component.spec.ts`
- Modify: `src/app/features/users/components/user-access-list/user-access-list.component.css`
- Modify: `src/app/features/users/components/access-profile-list/access-profile-list.component.css`

- [ ] **Step 1: Write failing control-style assertions**

Add assertions in each catalog spec:

```ts
const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;

for (const control of [input, select]) {
  const style = getComputedStyle(control);
  expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  expect(style.borderTopLeftRadius).toBe('8px');
}
```

In the Users spec, also assert its search font family matches the Profiles search font family token (`Crimson Pro`).

- [ ] **Step 2: Run both focused specs and verify RED**

Run:

```powershell
npm test -- --watch=false --browsers=ChromeHeadless --include="**/user-access-list.component.spec.ts" --include="**/access-profile-list.component.spec.ts"
```

Expected: Users fails on 40px height and square radius; Profiles fails on the 42px minimum.

- [ ] **Step 3: Apply the application control language**

Use the same values in both component styles:

```css
.catalog-control {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: .7rem .8rem;
  border: 1px solid var(--border-2);
  border-radius: 8px;
  background-color: color-mix(in srgb, var(--bg-panel) 78%, var(--bg));
  color: var(--text);
  font-family: 'Crimson Pro', Georgia, serif;
  font-size: .92rem;
  outline: none;
  transition: border-color .18s ease, box-shadow .18s ease, background-color .18s ease;
}

.catalog-control:hover {
  border-color: color-mix(in srgb, var(--amber) 28%, var(--border-2));
}

.catalog-control:focus-visible {
  border-color: color-mix(in srgb, var(--amber) 45%, var(--border-2));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--amber) 10%, transparent);
}
```

Implement these declarations with each component's existing selectors; do not introduce a global stylesheet or change template bindings. Retain select arrow styling from the application.

- [ ] **Step 4: Run both focused specs and verify GREEN**

Expected: both catalog specs pass.

- [ ] **Step 5: Commit**

```powershell
git add src/app/features/users/components/user-access-list src/app/features/users/components/access-profile-list
git commit -m "style(users): standardize access filters"
```

### Task 3: Widen and decompress both editors

**Files:**
- Modify: `src/app/features/users/components/user-access-panel/user-access-panel.component.spec.ts`
- Modify: `src/app/features/users/components/access-profile-panel/access-profile-panel.component.spec.ts`
- Modify: `src/app/features/users/components/user-access-panel/user-access-panel.component.css`
- Modify: `src/app/features/users/components/access-profile-panel/access-profile-panel.component.css`

- [ ] **Step 1: Change panel regression expectations to 720px**

Update the current width assertions:

```ts
expect(panel.getBoundingClientRect().width).toBeCloseTo(720, 0);
```

For each panel, add:

```ts
const body = fixture.nativeElement.querySelector(
  '.access-panel__body, .profile-panel__body'
) as HTMLElement;
expect(parseFloat(getComputedStyle(body).paddingLeft)).toBeGreaterThanOrEqual(28);
```

- [ ] **Step 2: Run both panel specs and verify RED**

Run:

```powershell
npm test -- --watch=false --browsers=ChromeHeadless --include="**/user-access-panel.component.spec.ts" --include="**/access-profile-panel.component.spec.ts"
```

Expected: failures report 440px and 560px widths and current compact body padding.

- [ ] **Step 3: Implement shared spacious dimensions**

Update both panel styles:

```css
.access-panel,
.profile-panel {
  width: min(720px, 100vw, 100%);
}
```

Apply `1.75rem 2rem` horizontal/body padding on desktop, section gaps of at least `1.25rem`, 44px form controls, and footer padding of at least `1rem 2rem`. Preserve current scroll containers, sticky/fixed footer behavior, focus management, z-index, and reduced-motion rules.

Keep the existing full-host-width behavior at `max-width: 900px`; at phone widths reduce horizontal padding to `1rem`.

- [ ] **Step 4: Run panel specs and verify GREEN**

Expected: both panel specs pass at 720px, 900px, and 375px host widths.

- [ ] **Step 5: Run full verification**

```powershell
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
git diff --check
```

Expected: all tests and build exit `0`; only pre-existing build warnings remain.

- [ ] **Step 6: Review live UI**

Inspect `/users` at:

- `1280 × 800`;
- `768 × 1024`;
- `375 × 812`.

Verify identical catalog framing and controls, matching action buttons, readable panel spacing, internal panel scrolling, visible header/footer, and no horizontal overflow.

- [ ] **Step 7: Commit**

```powershell
git add src/app/features/users/components
git commit -m "style(users): expand access editors"
```
