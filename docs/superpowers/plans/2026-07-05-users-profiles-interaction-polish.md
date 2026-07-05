# Users and Profiles Interaction Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the remaining harsh permission and branch visuals with softer application-native controls and give both access panels the same opening and closing motion as Customers.

**Architecture:** Keep all form and selection APIs intact. CSS customizes the existing semantic checkbox inputs and permission chips. `UsersComponent` owns the closing lifecycle so dirty confirmation occurs before animation and each panel remains mounted for the 240ms exit transition.

**Tech Stack:** Angular 16 standalone components, Jasmine/Karma, component-scoped CSS, CSS keyframes.

---

### Task 1: Soften permission chips and checks

**Files:**
- Modify: `src/app/features/users/components/user-access-panel/user-access-panel.component.spec.ts`
- Modify: `src/app/features/users/components/user-access-panel/user-access-panel.component.css`
- Modify: `src/app/features/users/components/permission-matrix/permission-matrix.component.spec.ts`
- Modify: `src/app/features/users/components/permission-matrix/permission-matrix.component.css`

- [ ] **Step 1: Write failing style regression tests**

Add to `user-access-panel.component.spec.ts`:

```ts
it('uses pill permission tags and soft branch checks', () => {
  render('edit');
  const permission = query('.access-panel__module li') as HTMLElement;
  const check = query('.access-panel__check') as HTMLElement;

  expect(getComputedStyle(permission).borderTopLeftRadius).toBe('999px');
  expect(getComputedStyle(check).borderTopLeftRadius).toBe('6px');
  expect(parseFloat(getComputedStyle(check).width)).toBeGreaterThanOrEqual(20);
});
```

Add to `permission-matrix.component.spec.ts`:

```ts
it('uses soft custom checks and selected permission cards', () => {
  fixture.componentRef.setInput('permissions', permissions);
  fixture.componentRef.setInput('selectedCodes', ['sales.access']);
  fixture.detectChanges();
  component.toggleExpanded('Ventas');
  fixture.detectChanges();

  const check = fixture.nativeElement.querySelector('.permission-row input') as HTMLInputElement;
  const row = fixture.nativeElement.querySelector('.permission-row--selected') as HTMLElement;
  expect(getComputedStyle(check).appearance).toBe('none');
  expect(getComputedStyle(check).borderTopLeftRadius).toBe('5px');
  expect(getComputedStyle(row).borderTopWidth).toBe('1px');
  expect(getComputedStyle(row).borderTopLeftRadius).toBe('10px');
});
```

- [ ] **Step 2: Run focused specs and verify RED**

```powershell
npm test -- --watch=false --browsers=ChromeHeadless --include="**/user-access-panel.component.spec.ts" --include="**/permission-matrix.component.spec.ts"
```

Expected: square permission tags, 17.6px square branch indicators, native permission checks, and borderless permission rows fail.

- [ ] **Step 3: Implement softer controls**

In `user-access-panel.component.css`:

```css
.access-panel__module li {
  padding: .38rem .65rem;
  border: 1px solid color-mix(in srgb, var(--amber) 18%, var(--border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--amber) 7%, transparent);
}

.access-panel__check {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg) 70%, var(--bg-panel));
  transition: border-color .16s ease, background .16s ease, box-shadow .16s ease, transform .16s ease;
}

.access-panel__branch:hover .access-panel__check {
  border-color: color-mix(in srgb, var(--amber) 42%, var(--border-2));
}
```

Retain the current check-mark drawing, checked semantics, disabled opacity, and focus-visible outline.

In `permission-matrix.component.css`, style both `.permission-row input` and `.permission-matrix__selected-only input`:

```css
.permission-matrix__selected-only input,
.permission-row input {
  appearance: none;
  display: grid;
  width: 1.125rem;
  height: 1.125rem;
  place-content: center;
  margin: 0;
  border: 1px solid var(--border-2);
  border-radius: 5px;
  background: color-mix(in srgb, var(--bg) 70%, var(--bg-panel));
  transition: border-color .16s ease, background .16s ease, box-shadow .16s ease, transform .16s ease;
}

.permission-matrix__selected-only input::before,
.permission-row input::before {
  width: .58rem;
  height: .32rem;
  border: solid #1a1309;
  border-width: 0 0 2px 2px;
  content: '';
  transform: rotate(-45deg) scale(0);
  transition: transform .14s ease;
}

.permission-matrix__selected-only input:checked,
.permission-row input:checked {
  border-color: color-mix(in srgb, var(--amber) 72%, var(--border));
  background: var(--amber);
}

.permission-matrix__selected-only input:checked::before,
.permission-row input:checked::before {
  transform: rotate(-45deg) scale(1);
}

.permission-row {
  border: 1px solid transparent;
  border-radius: 10px;
  transition: border-color .16s ease, background .16s ease, transform .16s ease;
}

.permission-row--selected {
  border-color: color-mix(in srgb, var(--amber) 18%, var(--border));
  background: color-mix(in srgb, var(--amber) 7%, var(--bg-panel));
  box-shadow: none;
}
```

- [ ] **Step 4: Run focused specs and verify GREEN**

Expected: both component specs pass.

- [ ] **Step 5: Commit**

```powershell
git add src/app/features/users/components/user-access-panel src/app/features/users/components/permission-matrix
git commit -m "style(users): soften access checks and permission tags"
```

### Task 2: Add Customers-style panel exit lifecycle

**Files:**
- Modify: `src/app/features/users/users.component.ts`
- Modify: `src/app/features/users/users.component.html`
- Modify: `src/app/features/users/users.component.spec.ts`
- Modify: `src/app/features/users/components/user-access-panel/user-access-panel.component.css`
- Modify: `src/app/features/users/components/access-profile-panel/access-profile-panel.component.css`

- [ ] **Step 1: Write failing coordinator tests**

Update close and save specs to use `fakeAsync`, then assert the panel remains mounted during exit:

```ts
it('keeps the user panel mounted during its exit animation', fakeAsync(() => {
  render();
  component.openUserCreator();

  component.requestUserPanelClose(false);
  tick();

  expect(component.userPanelClosing).toBeTrue();
  expect(component.userPanelMode).toBe('create');
  fixture.detectChanges();
  expect(query('app-user-access-panel')?.classList).toContain('access-panel-host--closing');

  tick(240);
  expect(component.userPanelMode).toBe('closed');
  expect(component.userPanelClosing).toBeFalse();
}));

it('keeps the profile panel mounted during its exit animation', fakeAsync(() => {
  render();
  component.openProfileEditor(component.profiles[0]);

  component.requestProfilePanelClose(false);
  tick();

  expect(component.profilePanelClosing).toBeTrue();
  expect(component.profilePanelMode).toBe('edit');
  fixture.detectChanges();
  expect(query('app-access-profile-panel')?.classList).toContain('profile-panel-host--closing');

  tick(240);
  expect(component.profilePanelMode).toBe('closed');
  expect(component.profilePanelClosing).toBeFalse();
}));
```

Adjust existing successful create/edit save tests to assert `*PanelClosing === true`, then `tick(240)` before asserting closed state. Error-path tests continue asserting that panels remain open and not closing.

- [ ] **Step 2: Run Users integration spec and verify RED**

```powershell
npm test -- --watch=false --browsers=ChromeHeadless --include="**/users.component.spec.ts"
```

Expected: compilation fails because closing state does not exist and current teardown is immediate.

- [ ] **Step 3: Implement delayed final teardown**

Add public state and private timers to `UsersComponent`:

```ts
userPanelClosing = false;
profilePanelClosing = false;
private userPanelCloseTimer: ReturnType<typeof setTimeout> | null = null;
private profilePanelCloseTimer: ReturnType<typeof setTimeout> | null = null;
private readonly panelExitDuration = 240;
```

Opening a panel clears its matching timer and resets closing state. Closing starts the CSS state and schedules final teardown:

```ts
private beginUserPanelClose(preferredUserId?: string): void {
  if (this.userPanelClosing || this.userPanelMode === 'closed') return;
  this.userPanelClosing = true;
  this.cdr.markForCheck();
  this.userPanelCloseTimer = setTimeout(() => {
    this.userPanelCloseTimer = null;
    this.userPanelClosing = false;
    this.finalizeUserPanelClose(preferredUserId);
  }, this.panelExitDuration);
}

private beginProfilePanelClose(): void {
  if (this.profilePanelClosing || this.profilePanelMode === 'closed') return;
  this.profilePanelClosing = true;
  this.cdr.markForCheck();
  this.profilePanelCloseTimer = setTimeout(() => {
    this.profilePanelCloseTimer = null;
    this.profilePanelClosing = false;
    this.finalizeProfilePanelClose();
  }, this.panelExitDuration);
}
```

Rename existing immediate close helpers to `finalizeUserPanelClose` and `finalizeProfilePanelClose`. Replace successful save, confirmed close, and selected-profile deletion calls with the matching `begin...Close`.

Guard save/close methods with the matching closing flag. In `ngOnDestroy`, clear both timers.

Apply host classes in `users.component.html`:

```html
<app-user-access-panel
  [class.access-panel-host--closing]="userPanelClosing"
  ...>
</app-user-access-panel>

<app-access-profile-panel
  [class.profile-panel-host--closing]="profilePanelClosing"
  ...>
</app-access-profile-panel>
```

- [ ] **Step 4: Match Customers drawer keyframes**

In both panel styles, use:

```css
animation: access-drawer-in .42s cubic-bezier(.16, 1, .3, 1) both;
will-change: transform, opacity;
```

Add closing states and backdrop motion:

```css
:host(.access-panel-host--closing),
:host(.profile-panel-host--closing) {
  pointer-events: none;
}

:host(.access-panel-host--closing) .access-panel,
:host(.profile-panel-host--closing) .profile-panel {
  animation: access-drawer-out .24s cubic-bezier(.4, 0, 1, 1) both;
}

:host(.access-panel-host--closing) .access-panel__backdrop,
:host(.profile-panel-host--closing) .profile-panel__backdrop {
  animation: access-backdrop-out .22s ease both;
}

@keyframes access-drawer-in {
  0% { opacity: 0; transform: translateX(42px); }
  58% { opacity: 1; }
  100% { opacity: 1; transform: translateX(0); }
}

@keyframes access-drawer-out {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(28px); }
}

@keyframes access-backdrop-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes access-backdrop-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
```

Keep existing reduced-motion rules and include all new keyframes there with `animation: none`.

- [ ] **Step 5: Run integration and panel specs**

```powershell
npm test -- --watch=false --browsers=ChromeHeadless --include="**/users.component.spec.ts" --include="**/user-access-panel.component.spec.ts" --include="**/access-profile-panel.component.spec.ts"
```

Expected: all focused specs pass.

- [ ] **Step 6: Commit**

```powershell
git add src/app/features/users
git commit -m "feat(users): animate access panel lifecycle"
```

### Task 3: Final verification and visual review

**Files:**
- Modify only if verification exposes a scoped defect.

- [ ] **Step 1: Run automated verification**

```powershell
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
git diff --check
```

Expected: all commands exit `0`; only pre-existing build warnings remain.

- [ ] **Step 2: Review live behavior**

Inspect `/users` at `1280 × 800` and `375 × 812`. Verify:

- permission summary tags are rounded pills;
- branch and permission checks are visible, soft, and keyboard-focusable;
- selected permission rows no longer use a hard left stripe;
- both panels animate in and out with Customers timing;
- dirty confirmation appears before exit starts;
- header, footer, and horizontal overflow remain correct.

- [ ] **Step 3: Record clean state**

```powershell
git status --short
git log --oneline --max-count=8
```

Expected: clean worktree and focused commits for styling and motion.
