# Users and Profiles Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la pantalla densa de Usuarios y Perfiles por listados prioritarios y paneles contextuales para altas y ediciones, conservando APIs y reglas actuales.

**Architecture:** `UsersComponent` queda como coordinador de carga, mutaciones y confirmaciones. Componentes standalone separados resuelven los listados, los paneles laterales y la matriz de permisos; los filtros puros viven en un módulo presentacional testeable. Usuarios y Perfiles permanecen montados para conservar su estado al cambiar de pestaña.

**Tech Stack:** Angular 16 standalone components, Reactive Forms, RxJS, Jasmine/Karma, CSS responsive con custom properties.

---

### Task 1: Presentational models and pure filters

**Files:**
- Create: `src/app/features/users/users-ui.models.ts`
- Create: `src/app/features/users/users-ui.models.spec.ts`

- [ ] **Step 1: Write failing tests for user and profile filtering**

```ts
import { buildPermissionModules, filterAccessProfiles, filterAccessUsers, profileUsageCount } from './users-ui.models';

describe('users UI models', () => {
  const users = [
    { id: 'u1', username: 'agustin', email: 'a@x.com', employeeName: 'Agustín Testa', isActive: true, profileId: 'p1', branchIds: ['b1'] },
    { id: 'u2', username: 'caja', email: 'c@x.com', employeeName: null, isActive: false, profileId: 'p2', branchIds: [] }
  ] as any[];

  it('combines user search, status, profile and branch filters', () => {
    expect(filterAccessUsers(users, {
      query: 'testa', status: 'active', profileId: 'p1', branchId: 'b1'
    }).map(user => user.id)).toEqual(['u1']);
  });

  it('filters profiles by text, type and usage', () => {
    const profiles = [
      { id: 'p1', name: 'Admin', description: 'Operación', isSystem: true },
      { id: 'p2', name: 'Caja tarde', description: null, isSystem: false }
    ] as any[];

    expect(filterAccessProfiles(profiles, users, {
      query: 'caja', type: 'custom', usage: 'used'
    }).map(profile => profile.id)).toEqual(['p2']);
    expect(profileUsageCount('p1', users as any)).toBe(1);
  });

  it('groups permissions with friendly action labels', () => {
    const modules = buildPermissionModules([
      { code: 'sales.access', label: 'Ventas: acceso', description: 'Ingresar a ventas' }
    ], ['sales.access']);
    expect(modules[0].label).toBe('Ventas');
    expect(modules[0].permissions[0].action).toBe('acceso');
    expect(modules[0].permissions[0].selected).toBeTrue();
  });
});
```

- [ ] **Step 2: Run the model spec and verify RED**

Run:

```powershell
npm test -- --watch=false --browsers=ChromeHeadless --include="**/users-ui.models.spec.ts"
```

Expected: compilation fails because `users-ui.models.ts` does not exist.

- [ ] **Step 3: Implement types and pure helpers**

```ts
import { AccessProfileResponse } from '../../core/models/access-profile.models';
import { UserResponse } from '../../core/models/user.models';

export type AccessSection = 'users' | 'profiles';
export type AccessPanelMode = 'closed' | 'create' | 'edit';

export interface UserAccessFilters {
  query: string;
  status: 'all' | 'active' | 'inactive';
  profileId: string;
  branchId: string;
}

export interface AccessProfileFilters {
  query: string;
  type: 'all' | 'system' | 'custom';
  usage: 'all' | 'used' | 'unused';
}

export interface UserAccessDraft {
  username: string;
  email: string;
  password: string;
  profileId: string;
  branchIds: string[];
}

export interface AccessProfileDraft {
  name: string;
  description: string | null;
  permissionCodes: string[];
}

export interface PermissionModuleView {
  label: string;
  total: number;
  selected: number;
  codes: string[];
  permissions: Array<{
    code: string;
    action: string;
    description: string;
    selected: boolean;
  }>;
}

export const EMPTY_USER_FILTERS: UserAccessFilters = {
  query: '', status: 'all', profileId: '', branchId: ''
};

export const EMPTY_PROFILE_FILTERS: AccessProfileFilters = {
  query: '', type: 'all', usage: 'all'
};

export function filterAccessUsers(users: UserResponse[], filters: UserAccessFilters): UserResponse[] {
  const query = filters.query.trim().toLowerCase();
  return users.filter(user => {
    const matchesQuery = !query || [user.username, user.email, user.employeeName ?? '']
      .some(value => value.toLowerCase().includes(query));
    const matchesStatus = filters.status === 'all'
      || (filters.status === 'active' ? user.isActive : !user.isActive);
    const matchesProfile = !filters.profileId || user.profileId === filters.profileId;
    const matchesBranch = !filters.branchId || user.branchIds.includes(filters.branchId);
    return matchesQuery && matchesStatus && matchesProfile && matchesBranch;
  });
}

export function profileUsageCount(profileId: string, users: UserResponse[]): number {
  return users.filter(user => user.profileId === profileId).length;
}

export function filterAccessProfiles(
  profiles: AccessProfileResponse[],
  users: UserResponse[],
  filters: AccessProfileFilters
): AccessProfileResponse[] {
  const query = filters.query.trim().toLowerCase();
  return profiles.filter(profile => {
    const usage = profileUsageCount(profile.id, users);
    const matchesQuery = !query
      || profile.name.toLowerCase().includes(query)
      || (profile.description ?? '').toLowerCase().includes(query);
    const matchesType = filters.type === 'all'
      || (filters.type === 'system' ? profile.isSystem : !profile.isSystem);
    const matchesUsage = filters.usage === 'all'
      || (filters.usage === 'used' ? usage > 0 : usage === 0);
    return matchesQuery && matchesType && matchesUsage;
  });
}

export function buildPermissionModules(
  permissions: ReadonlyArray<{ code: string; label: string; description: string }>,
  selectedCodes: string[],
  query = '',
  selectedOnly = false
): PermissionModuleView[] {
  const selected = new Set(selectedCodes);
  const term = query.trim().toLowerCase();
  const groups = new Map<string, PermissionModuleView['permissions']>();
  permissions
    .filter(permission => !selectedOnly || selected.has(permission.code))
    .filter(permission => !term
      || permission.label.toLowerCase().includes(term)
      || permission.description.toLowerCase().includes(term))
    .forEach(permission => {
      const [moduleLabel, ...actionParts] = permission.label.split(':');
      const label = moduleLabel.trim() || 'General';
      const bucket = groups.get(label) ?? [];
      bucket.push({
        code: permission.code,
        action: actionParts.join(':').trim() || permission.label,
        description: permission.description,
        selected: selected.has(permission.code)
      });
      groups.set(label, bucket);
    });
  return [...groups.entries()].map(([label, modulePermissions]) => ({
    label,
    total: modulePermissions.length,
    selected: modulePermissions.filter(permission => permission.selected).length,
    codes: modulePermissions.map(permission => permission.code),
    permissions: modulePermissions
  }));
}
```

- [ ] **Step 4: Run the model spec and verify GREEN**

Expected: all model tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/app/features/users/users-ui.models.ts src/app/features/users/users-ui.models.spec.ts
git commit -m "test(users): define access view models and filters"
```

### Task 2: User-first list

**Files:**
- Create: `src/app/features/users/components/user-access-list/user-access-list.component.ts`
- Create: `src/app/features/users/components/user-access-list/user-access-list.component.html`
- Create: `src/app/features/users/components/user-access-list/user-access-list.component.css`
- Create: `src/app/features/users/components/user-access-list/user-access-list.component.spec.ts`

- [ ] **Step 1: Write failing list tests**

```ts
it('renders users as the primary content and emits selection', () => {
  fixture.componentRef.setInput('users', [user]);
  fixture.detectChanges();
  spyOn(component.userSelected, 'emit');

  fixture.nativeElement.querySelector('[data-user-id="u1"] .user-list__open').click();

  expect(component.userSelected.emit).toHaveBeenCalledWith(user);
});

it('filters users without mutating the source collection', () => {
  fixture.componentRef.setInput('users', [activeUser, inactiveUser]);
  fixture.detectChanges();

  component.updateFilters({ ...component.filters, status: 'inactive' });

  expect(component.visibleUsers.map(user => user.id)).toEqual([inactiveUser.id]);
  expect(component.users.length).toBe(2);
});
```

- [ ] **Step 2: Run the focused spec and verify RED**

Run:

```powershell
npm test -- --watch=false --browsers=ChromeHeadless --include="**/user-access-list.component.spec.ts"
```

Expected: compilation fails because `UserAccessListComponent` does not exist.

- [ ] **Step 3: Implement the component API and derived state**

```ts
@Input() users: UserResponse[] = [];
@Input() profiles: AccessProfileResponse[] = [];
@Input() branches: BranchResponse[] = [];
@Input() loading = false;
@Input() selectedUserId: string | null = null;
@Output() userSelected = new EventEmitter<UserResponse>();
@Output() createRequested = new EventEmitter<void>();
@Output() statusRequested = new EventEmitter<UserResponse>();
@Output() reloadRequested = new EventEmitter<void>();

filters: UserAccessFilters = { ...EMPTY_USER_FILTERS };

get visibleUsers(): UserResponse[] {
  return filterAccessUsers(this.users, this.filters);
}

get hasActiveFilters(): boolean {
  return JSON.stringify(this.filters) !== JSON.stringify(EMPTY_USER_FILTERS);
}

updateFilters(filters: UserAccessFilters): void {
  this.filters = filters;
}

setQuery(query: string): void {
  this.updateFilters({ ...this.filters, query });
}

setStatus(status: UserAccessFilters['status']): void {
  this.updateFilters({ ...this.filters, status });
}

setProfile(profileId: string): void {
  this.updateFilters({ ...this.filters, profileId });
}

setBranch(branchId: string): void {
  this.updateFilters({ ...this.filters, branchId });
}

branchSummary(user: UserResponse): string {
  if (user.branchIds.length === 0) return 'Todas';
  if (user.branchIds.length === 1) {
    return this.branches.find(branch => branch.id === user.branchIds[0])?.name ?? '1 sucursal';
  }
  return `${user.branchIds.length} sucursales`;
}

clearFilters(): void {
  this.filters = { ...EMPTY_USER_FILTERS };
}
```

Build the template with a single toolbar, desktop headers, responsive rows/cards, skeleton rows, distinct empty/no-results states, accessible `Editar usuario` controls and an overflow action for status. Use friendly branch summaries (`Todas`, one name, or `N sucursales`).

```html
<section class="user-list" aria-labelledby="users-list-title">
  <header class="user-list__header">
    <div><p class="eyebrow">Equipo</p><h2 id="users-list-title">Usuarios</h2></div>
    <button class="btn" type="button" (click)="createRequested.emit()">Nuevo usuario</button>
  </header>
  <div class="user-list__toolbar">
    <input class="control" type="search" [ngModel]="filters.query"
      (ngModelChange)="setQuery($event)"
      placeholder="Buscar usuario, email o empleado..." />
    <select [ngModel]="filters.status"
      (ngModelChange)="setStatus($event)">
      <option value="all">Todos los estados</option>
      <option value="active">Activos</option>
      <option value="inactive">Inactivos</option>
    </select>
    <select [ngModel]="filters.profileId" (ngModelChange)="setProfile($event)">
      <option value="">Todos los perfiles</option>
      <option *ngFor="let profile of profiles" [value]="profile.id">{{ profile.name }}</option>
    </select>
    <select [ngModel]="filters.branchId" (ngModelChange)="setBranch($event)">
      <option value="">Todas las sucursales</option>
      <option *ngFor="let branch of branches" [value]="branch.id">{{ branch.name }}</option>
    </select>
    <button *ngIf="hasActiveFilters" type="button" (click)="clearFilters()">Limpiar</button>
  </div>
  <div class="user-list__head" aria-hidden="true">
    <span>Usuario</span><span>Perfil</span><span>Sucursales</span><span>Estado</span><span>Acciones</span>
  </div>
  <article class="user-list__row" *ngFor="let user of visibleUsers" [attr.data-user-id]="user.id">
    <div class="user-list__identity"><strong>{{ user.username }}</strong><span>{{ user.email }}</span></div>
    <span>{{ user.profileName || 'Sin perfil' }}</span>
    <span>{{ branchSummary(user) }}</span>
    <span class="status">{{ user.isActive ? 'Activo' : 'Inactivo' }}</span>
    <div class="user-list__actions">
      <button class="user-list__open" type="button" (click)="userSelected.emit(user)">Editar usuario</button>
      <button type="button" (click)="statusRequested.emit(user)">{{ user.isActive ? 'Desactivar' : 'Activar' }}</button>
    </div>
  </article>
  <div class="empty" *ngIf="!loading && users.length === 0">Todavía no hay usuarios.</div>
  <div class="empty" *ngIf="!loading && users.length > 0 && visibleUsers.length === 0">
    No hay usuarios que coincidan. <button type="button" (click)="clearFilters()">Limpiar filtros</button>
  </div>
</section>
```

- [ ] **Step 4: Add responsive styling**

Use one five-column grid above `900px`. Below `900px`, hide the header and render each row as a two-column card; below `560px`, use one column. Keep touch targets at least `44px`.

```css
.user-list__head,
.user-list__row {
  display: grid;
  grid-template-columns: minmax(180px, 1.3fr) minmax(130px, .8fr) minmax(130px, .8fr) 90px minmax(150px, auto);
  gap: .8rem;
  align-items: center;
}
@media (max-width: 900px) {
  .user-list__head { display: none; }
  .user-list__row { grid-template-columns: minmax(0, 1fr) auto; min-height: 0; }
  .user-list__actions { grid-column: 1 / -1; }
}
@media (max-width: 560px) {
  .user-list__row, .user-list__toolbar { grid-template-columns: 1fr; }
  button, .control, select { min-height: 44px; }
}
```

- [ ] **Step 5: Run the focused spec and commit**

Expected: all user-list tests pass.

```powershell
git add src/app/features/users/components/user-access-list
git commit -m "feat(users): add user-first access list"
```

### Task 3: User create/edit side panel

**Files:**
- Create: `src/app/features/users/components/user-access-panel/user-access-panel.component.ts`
- Create: `src/app/features/users/components/user-access-panel/user-access-panel.component.html`
- Create: `src/app/features/users/components/user-access-panel/user-access-panel.component.css`
- Create: `src/app/features/users/components/user-access-panel/user-access-panel.component.spec.ts`

- [ ] **Step 1: Write failing panel tests**

```ts
it('shows identity fields only while creating a user', () => {
  fixture.componentRef.setInput('mode', 'create');
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('[formControlName="username"]')).not.toBeNull();

  fixture.componentRef.setInput('mode', 'edit');
  fixture.componentRef.setInput('user', user);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('[formControlName="username"]')).toBeNull();
  expect(fixture.nativeElement.textContent).toContain(user.email);
});

it('emits a draft with profile and branch scope', () => {
  fixture.componentRef.setInput('mode', 'edit');
  fixture.componentRef.setInput('user', user);
  fixture.componentRef.setInput('profiles', [profile]);
  fixture.detectChanges();
  component.form.patchValue({ profileId: profile.id });
  component.toggleBranch('b1');
  spyOn(component.saveRequested, 'emit');

  component.submit();

  expect(component.saveRequested.emit).toHaveBeenCalledWith(jasmine.objectContaining({
    profileId: profile.id,
    branchIds: ['b1']
  }));
});
```

- [ ] **Step 2: Run the focused spec and verify RED**

Expected: compilation fails because the panel component does not exist.

- [ ] **Step 3: Implement the panel**

Define inputs `mode`, `user`, `profiles`, `branches`, `permissionCatalog`, `saving`; outputs `saveRequested` and `closeRequested`. Use one reactive form:

```ts
@Input({ required: true }) mode!: Exclude<AccessPanelMode, 'closed'>;
@Input() user: UserResponse | null = null;
@Input() profiles: AccessProfileResponse[] = [];
@Input() branches: BranchResponse[] = [];
@Input() permissionCatalog = PermissionCatalog;
@Input() saving = false;
@Output() saveRequested = new EventEmitter<UserAccessDraft>();
@Output() closeRequested = new EventEmitter<boolean>();

selectedBranchIds = new Set<string>();
private initialBranchKey = '';
private loadedKey = '';

readonly form = this.fb.group({
  username: ['', [Validators.required, Validators.minLength(3)]],
  email: ['', [Validators.required, Validators.email]],
  password: ['', [Validators.required, Validators.minLength(6)]],
  profileId: ['', Validators.required]
});

ngOnChanges(): void {
  const key = `${this.mode}:${this.user?.id ?? 'new'}`;
  if (key === this.loadedKey) return;
  this.loadedKey = key;
  const branchIds = this.mode === 'edit' ? this.user?.branchIds ?? [] : [];
  this.selectedBranchIds = new Set(branchIds);
  this.initialBranchKey = [...branchIds].sort().join('|');
  this.form.reset({
    username: this.mode === 'create' ? '' : this.user?.username ?? '',
    email: this.mode === 'create' ? '' : this.user?.email ?? '',
    password: '',
    profileId: this.mode === 'edit' ? this.user?.profileId ?? '' : this.profiles[0]?.id ?? ''
  });
}

get branchScopeDirty(): boolean {
  return [...this.selectedBranchIds].sort().join('|') !== this.initialBranchKey;
}

get profileOptions(): SearchableSelectOption[] {
  return this.profiles.map(profile => ({ value: profile.id, label: profile.name, meta: profile.description ?? undefined }));
}

get selectedProfile(): AccessProfileResponse | null {
  return this.profiles.find(profile => profile.id === this.form.controls.profileId.value) ?? null;
}

get selectedPermissionModules(): PermissionModuleView[] {
  return buildPermissionModules(
    this.permissionCatalog,
    this.selectedProfile?.permissionCodes ?? [],
    '',
    true
  );
}

get selectedPermissionCount(): number {
  return this.selectedProfile?.permissionCodes.length ?? 0;
}

toggleBranch(branchId: string): void {
  this.selectedBranchIds.has(branchId)
    ? this.selectedBranchIds.delete(branchId)
    : this.selectedBranchIds.add(branchId);
}

submit(): void {
  const identityInvalid = this.form.controls.username.invalid
    || this.form.controls.email.invalid
    || this.form.controls.password.invalid;
  if (this.form.controls.profileId.invalid || (this.mode === 'create' && identityInvalid)) {
    this.form.markAllAsTouched();
    return;
  }
  const raw = this.form.getRawValue();
  this.saveRequested.emit({
    username: String(raw.username ?? '').trim(),
    email: String(raw.email ?? '').trim(),
    password: String(raw.password ?? ''),
    profileId: String(raw.profileId ?? ''),
    branchIds: [...this.selectedBranchIds]
  });
}

requestClose(): void {
  this.closeRequested.emit(this.form.dirty || this.branchScopeDirty);
}
```

For edit mode, render identity as read-only and validate only `profileId`. Expose `Todas las sucursales` explicitly, while emitting `[]` to preserve API semantics. Map selected profile permissions to friendly module counts and place full details in a collapsed disclosure.

```html
<div class="access-panel__backdrop" (click)="requestClose()"></div>
<aside class="access-panel" role="dialog" aria-modal="true"
  [attr.aria-labelledby]="'user-panel-title'">
  <header class="access-panel__header">
    <div><p class="eyebrow">{{ mode === 'create' ? 'Alta' : 'Acceso' }}</p>
      <h2 id="user-panel-title">{{ mode === 'create' ? 'Nuevo usuario' : user?.username }}</h2></div>
    <button type="button" aria-label="Cerrar panel" (click)="requestClose()">×</button>
  </header>
  <form [formGroup]="form" (ngSubmit)="submit()">
    <div class="access-panel__body">
      <ng-container *ngIf="mode === 'create'; else identityReadOnly">
        <input formControlName="username" placeholder="Usuario" />
        <input formControlName="email" type="email" placeholder="Email" />
        <input formControlName="password" type="password" placeholder="Password inicial" />
      </ng-container>
      <ng-template #identityReadOnly><p>{{ user?.email }} · {{ user?.employeeName || 'Sin empleado vinculado' }}</p></ng-template>
      <app-searchable-select formControlName="profileId" [options]="profileOptions"></app-searchable-select>
      <label class="branch-option">
        <input type="checkbox" [checked]="selectedBranchIds.size === 0" (change)="selectedBranchIds.clear()" />
        Todas las sucursales
      </label>
      <label class="branch-option" *ngFor="let branch of branches">
        <input type="checkbox" [checked]="selectedBranchIds.has(branch.id)" (change)="toggleBranch(branch.id)" />
        {{ branch.name }}
      </label>
      <details><summary>{{ selectedPermissionCount }} permisos heredados · Ver detalle</summary>
        <div *ngFor="let module of selectedPermissionModules">{{ module.label }} · {{ module.selected }}</div>
      </details>
    </div>
    <footer class="access-panel__footer">
      <button type="button" (click)="requestClose()">Cancelar</button>
      <button type="submit" [disabled]="saving">{{ saving ? 'Guardando...' : 'Guardar cambios' }}</button>
    </footer>
  </form>
</aside>
```

- [ ] **Step 4: Implement panel accessibility and responsive CSS**

Use `role="dialog"`, `aria-modal="true"`, backdrop, initial focus, `Escape`, fixed header/footer, a `440px` desktop width and full viewport width below `900px`. Restore focus through the parent trigger after close.

```ts
@ViewChild('panelTitle', { read: ElementRef }) panelTitle?: ElementRef<HTMLElement>;

ngAfterViewInit(): void {
  queueMicrotask(() => this.panelTitle?.nativeElement.focus());
}

@HostListener('document:keydown.escape')
handleEscape(): void {
  this.requestClose();
}
```

Add `#panelTitle tabindex="-1"` to the panel `<h2>`. In `UsersComponent`, capture `document.activeElement` before opening and call `.focus()` after a successful or cancelled close.

```css
.access-panel { position:fixed; inset:0 0 0 auto; z-index:90; display:grid; grid-template-rows:auto 1fr; width:min(440px,100vw); }
.access-panel form { min-height:0; display:grid; grid-template-rows:1fr auto; }
.access-panel__body { overflow:auto; padding:1rem; }
.access-panel__header, .access-panel__footer { position:sticky; background:var(--bg-panel); }
@media (max-width:900px) { .access-panel { width:100vw; } }
```

- [ ] **Step 5: Run tests and commit**

```powershell
git add src/app/features/users/components/user-access-panel
git commit -m "feat(users): add contextual user access panel"
```

### Task 4: Integrate the Users section

**Files:**
- Create: `src/app/features/users/users.component.spec.ts`
- Modify: `src/app/features/users/users.component.ts`
- Modify: `src/app/features/users/users.component.html`
- Modify: `src/app/features/users/users.component.css`

- [ ] **Step 1: Write failing integration tests**

Mock `UserService`, `AccessProfileService`, `BranchService`, `AuthService`, `ToastService` and `ConfirmationService`, then add:

```ts
it('opens on the users list without rendering a permanent create form', () => {
  fixture.detectChanges();
  expect(component.activeSection).toBe('users');
  expect(fixture.nativeElement.querySelector('app-user-access-list')).not.toBeNull();
  expect(fixture.nativeElement.querySelector('app-user-access-panel')).toBeNull();
});

it('opens edit mode for the selected user', () => {
  component.openUserEditor(user);
  fixture.detectChanges();
  expect(component.userPanelMode).toBe('edit');
  expect(component.selectedUser?.id).toBe(user.id);
});

it('keeps an errored user draft open', () => {
  userService.updateProfile.and.returnValue(throwError(() => ({ error: { message: 'falló' } })));
  component.openUserEditor(user);
  component.saveUserDraft(draft);
  expect(component.userPanelMode).toBe('edit');
});
```

- [ ] **Step 2: Run the integration spec and verify RED**

Expected: compilation fails because the new section state and child components are absent.

- [ ] **Step 3: Wire user list and panel**

Replace `activeSection: 'admin' | 'profiles'` with `AccessSection`, initially `users`. Add:

```ts
userPanelMode: AccessPanelMode = 'closed';
selectedUser: UserResponse | null = null;
userPanelSaving = false;

openUserCreator(): void {
  this.selectedUser = null;
  this.userPanelMode = 'create';
}

openUserEditor(user: UserResponse): void {
  this.selectedUser = user;
  this.userPanelMode = 'edit';
}

saveUserDraft(draft: UserAccessDraft): void {
  this.userPanelSaving = true;
  const action = this.userPanelMode === 'create'
    ? this.userService.createUser({ ...draft, employeeId: null })
    : this.userService.updateProfile(this.selectedUser!.id, {
        profileId: draft.profileId,
        employeeId: this.selectedUser!.employeeId ?? null,
        branchIds: draft.branchIds
      });
  action.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
    next: user => {
      this.patchUser(user);
      this.userPanelSaving = false;
      this.userPanelMode = 'closed';
      this.toast.success(this.selectedUser ? 'Acceso actualizado' : 'Usuario creado');
      this.selectedUser = null;
      this.cdr.markForCheck();
    },
    error: err => {
      this.userPanelSaving = false;
      this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo guardar el usuario');
      this.cdr.markForCheck();
    }
  });
}
```

Use `ConfirmationService` before closing dirty panels and before deactivation. Keep both section containers mounted with `[hidden]`.

```ts
async requestUserPanelClose(dirty: boolean): Promise<void> {
  if (dirty && !await this.confirmation.confirm({
    eyebrow: 'Cambios sin guardar',
    title: 'Cerrar edición',
    message: 'Los cambios del usuario se perderán.',
    confirmLabel: 'Descartar cambios',
    tone: 'warning'
  })) return;
  this.userPanelMode = 'closed';
  this.selectedUser = null;
}

async requestUserStatusChange(user: UserResponse): Promise<void> {
  if (user.isActive && !await this.confirmation.confirm({
    eyebrow: 'Acceso de usuario',
    title: 'Desactivar usuario',
    message: `${user.username} no podrá acceder al sistema.`,
    confirmLabel: 'Desactivar',
    tone: 'danger'
  })) return;
  this.toggleStatus(user);
}
```

- [ ] **Step 4: Replace the legacy Users markup**

Render the simplified hero, accessible tabs, `<app-user-access-list>` and conditional `<app-user-access-panel>`. Remove the old permanent create form and expandable user cards. Keep the legacy Profiles section temporarily mounted until Task 8.

```html
<header class="access-hero"><p class="eyebrow">_ ACCESOS</p><h1>Usuarios y perfiles</h1></header>
<nav class="access-tabs" role="tablist" aria-label="Administración de accesos">
  <button role="tab" [attr.aria-selected]="activeSection === 'users'" (click)="selectSection('users')">Usuarios · {{ users.length }}</button>
  <button role="tab" [attr.aria-selected]="activeSection === 'profiles'" (click)="selectSection('profiles')">Perfiles · {{ profiles.length }}</button>
</nav>
<section [hidden]="activeSection !== 'users'">
  <app-user-access-list [users]="users" [profiles]="profiles" [branches]="branches"
    [loading]="loadingUsers" [selectedUserId]="selectedUser?.id ?? null"
    (createRequested)="openUserCreator()" (userSelected)="openUserEditor($event)"
    (statusRequested)="requestUserStatusChange($event)"></app-user-access-list>
</section>
<app-user-access-panel *ngIf="userPanelMode !== 'closed'" [mode]="$any(userPanelMode)"
  [user]="selectedUser" [profiles]="profiles" [branches]="branches" [saving]="userPanelSaving"
  (saveRequested)="saveUserDraft($event)" (closeRequested)="requestUserPanelClose($event)">
</app-user-access-panel>
```

- [ ] **Step 5: Run focused and full tests, then commit**

```powershell
npm test -- --watch=false --browsers=ChromeHeadless --include="**/users.component.spec.ts"
npm test -- --watch=false --browsers=ChromeHeadless
git add src/app/features/users
git commit -m "feat(users): integrate user-first management flow"
```

### Task 5: Friendly permission matrix

**Files:**
- Create: `src/app/features/users/components/permission-matrix/permission-matrix.component.ts`
- Create: `src/app/features/users/components/permission-matrix/permission-matrix.component.html`
- Create: `src/app/features/users/components/permission-matrix/permission-matrix.component.css`
- Create: `src/app/features/users/components/permission-matrix/permission-matrix.component.spec.ts`

- [ ] **Step 1: Write failing matrix tests**

```ts
it('groups permissions by module and hides technical codes', () => {
  fixture.componentRef.setInput('permissions', PermissionCatalog);
  fixture.componentRef.setInput('selectedCodes', ['sales.access']);
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).toContain('Ventas');
  expect(fixture.nativeElement.textContent).toContain('acceso');
  expect(fixture.nativeElement.textContent).not.toContain('sales.access');
});

it('emits an immutable selection when toggling a module', () => {
  spyOn(component.selectedCodesChange, 'emit');
  component.toggleModule(['sales.access', 'sales.create']);
  expect(component.selectedCodesChange.emit).toHaveBeenCalledWith(['sales.access', 'sales.create']);
});
```

- [ ] **Step 2: Run the focused spec and verify RED**

Expected: compilation fails because `PermissionMatrixComponent` does not exist.

- [ ] **Step 3: Implement grouped selection**

Inputs: `permissions`, `selectedCodes`; output: `selectedCodesChange`. Internal state: `query`, `selectedOnly`, `expandedModules`. Derive module from the label prefix before `:` and visible action from the suffix. Module headers show selected/total counts and provide select-all/clear actions. Render labels and descriptions only.

```ts
@Input() permissions: ReadonlyArray<{ code: string; label: string; description: string }> = [];
@Input() selectedCodes: string[] = [];
@Output() selectedCodesChange = new EventEmitter<string[]>();
query = '';
selectedOnly = false;
expandedModules = new Set<string>();

get modules(): PermissionModuleView[] {
  return buildPermissionModules(this.permissions, this.selectedCodes, this.query, this.selectedOnly);
}

togglePermission(code: string): void {
  const next = new Set(this.selectedCodes);
  next.has(code) ? next.delete(code) : next.add(code);
  this.selectedCodesChange.emit([...next]);
}

toggleModule(codes: string[]): void {
  const next = new Set(this.selectedCodes);
  const allSelected = codes.every(code => next.has(code));
  codes.forEach(code => allSelected ? next.delete(code) : next.add(code));
  this.selectedCodesChange.emit([...next]);
}

toggleExpanded(label: string): void {
  const next = new Set(this.expandedModules);
  next.has(label) ? next.delete(label) : next.add(label);
  this.expandedModules = next;
}
```

- [ ] **Step 4: Add search, selected-only and responsive styles**

Modules begin collapsed. Search filters by label or description. Keep controls sticky at the top of the panel content when the list scrolls. Use one permission row per line on tablet.

```html
<div class="permission-matrix__toolbar">
  <input type="search" [(ngModel)]="query" placeholder="Buscar permiso..." />
  <label><input type="checkbox" [(ngModel)]="selectedOnly" /> Sólo seleccionados</label>
</div>
<article class="permission-module" *ngFor="let module of modules">
  <button type="button" class="permission-module__head" (click)="toggleExpanded(module.label)">
    <strong>{{ module.label }}</strong><span>{{ module.selected }} de {{ module.total }} seleccionados</span>
  </button>
  <div *ngIf="expandedModules.has(module.label)">
    <button type="button" (click)="toggleModule(module.codes)">Seleccionar o limpiar módulo</button>
    <label class="permission-row" *ngFor="let permission of module.permissions">
      <input type="checkbox" [checked]="permission.selected" (change)="togglePermission(permission.code)" />
      <span><strong>{{ permission.action }}</strong><small>{{ permission.description }}</small></span>
    </label>
  </div>
</article>
```

- [ ] **Step 5: Run tests and commit**

```powershell
git add src/app/features/users/components/permission-matrix
git commit -m "feat(users): add friendly permission matrix"
```

### Task 6: Profile-first catalog

**Files:**
- Create: `src/app/features/users/components/access-profile-list/access-profile-list.component.ts`
- Create: `src/app/features/users/components/access-profile-list/access-profile-list.component.html`
- Create: `src/app/features/users/components/access-profile-list/access-profile-list.component.css`
- Create: `src/app/features/users/components/access-profile-list/access-profile-list.component.spec.ts`

- [ ] **Step 1: Write failing catalog tests**

```ts
it('shows profile usage counts and emits selection', () => {
  fixture.componentRef.setInput('profiles', [profile]);
  fixture.componentRef.setInput('users', [userWithProfile]);
  fixture.detectChanges();
  spyOn(component.profileSelected, 'emit');

  expect(fixture.nativeElement.textContent).toContain('1 usuario');
  fixture.nativeElement.querySelector('[data-profile-id="p1"] .profile-list__open').click();
  expect(component.profileSelected.emit).toHaveBeenCalledWith(profile);
});

it('distinguishes empty catalog from filtered results', () => {
  fixture.componentRef.setInput('profiles', [profile]);
  fixture.detectChanges();
  component.updateFilters({ query: 'sin coincidencia', type: 'all', usage: 'all' });
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('No hay perfiles que coincidan');
});
```

- [ ] **Step 2: Run focused spec and verify RED**

Expected: compilation fails because the component does not exist.

- [ ] **Step 3: Implement catalog, filters and usage counts**

Inputs: `profiles`, `users`, `loading`, `selectedProfileId`; outputs: `profileSelected`, `createRequested`, `deleteRequested`, `reloadRequested`. Use `filterAccessProfiles` and `profileUsageCount`. Desktop columns are profile, type, permissions, users and actions; tablet uses cards.

```ts
@Input() profiles: AccessProfileResponse[] = [];
@Input() users: UserResponse[] = [];
@Input() loading = false;
@Input() selectedProfileId: string | null = null;
@Output() profileSelected = new EventEmitter<AccessProfileResponse>();
@Output() createRequested = new EventEmitter<void>();
@Output() deleteRequested = new EventEmitter<AccessProfileResponse>();
filters: AccessProfileFilters = { ...EMPTY_PROFILE_FILTERS };
get visibleProfiles(): AccessProfileResponse[] {
  return filterAccessProfiles(this.profiles, this.users, this.filters);
}
usage(profileId: string): number {
  return profileUsageCount(profileId, this.users);
}
updateFilters(filters: AccessProfileFilters): void {
  this.filters = filters;
}
setQuery(query: string): void { this.updateFilters({ ...this.filters, query }); }
setType(type: AccessProfileFilters['type']): void { this.updateFilters({ ...this.filters, type }); }
setUsage(usage: AccessProfileFilters['usage']): void { this.updateFilters({ ...this.filters, usage }); }
```

```html
<section class="profile-list">
  <header><h2>Perfiles</h2><button type="button" (click)="createRequested.emit()">Nuevo perfil</button></header>
  <div class="profile-list__toolbar">
    <input type="search" [ngModel]="filters.query"
      (ngModelChange)="setQuery($event)" placeholder="Buscar perfil..." />
    <select [ngModel]="filters.type" (ngModelChange)="setType($event)">
      <option value="all">Todos los tipos</option><option value="system">Sistema</option><option value="custom">Personalizados</option>
    </select>
    <select [ngModel]="filters.usage" (ngModelChange)="setUsage($event)">
      <option value="all">Todos</option><option value="used">Asignados</option><option value="unused">Sin usuarios</option>
    </select>
  </div>
  <article *ngFor="let profile of visibleProfiles" [attr.data-profile-id]="profile.id" class="profile-list__row">
    <div><strong>{{ profile.name }}</strong><span>{{ profile.description || 'Sin descripción' }}</span></div>
    <span>{{ profile.isSystem ? 'Sistema' : 'Personalizado' }}</span>
    <span>{{ profile.permissionCodes.length }} permisos</span>
    <span>{{ usage(profile.id) }} {{ usage(profile.id) === 1 ? 'usuario' : 'usuarios' }}</span>
    <button class="profile-list__open" type="button" (click)="profileSelected.emit(profile)">Editar</button>
  </article>
</section>
```

- [ ] **Step 4: Run tests and commit**

```powershell
git add src/app/features/users/components/access-profile-list
git commit -m "feat(users): add profile-first catalog"
```

### Task 7: Profile create/edit panel

**Files:**
- Create: `src/app/features/users/components/access-profile-panel/access-profile-panel.component.ts`
- Create: `src/app/features/users/components/access-profile-panel/access-profile-panel.component.html`
- Create: `src/app/features/users/components/access-profile-panel/access-profile-panel.component.css`
- Create: `src/app/features/users/components/access-profile-panel/access-profile-panel.component.spec.ts`

- [ ] **Step 1: Write failing panel tests**

```ts
it('loads an existing profile and reports affected users', () => {
  fixture.componentRef.setInput('mode', 'edit');
  fixture.componentRef.setInput('profile', profile);
  fixture.componentRef.setInput('usageCount', 2);
  fixture.detectChanges();
  expect(component.form.controls.name.value).toBe(profile.name);
  expect(fixture.nativeElement.textContent).toContain('2 usuarios afectados');
});

it('emits friendly profile draft data', () => {
  fixture.componentRef.setInput('mode', 'create');
  fixture.detectChanges();
  component.form.patchValue({ name: 'Caja tarde', description: 'Turno tarde' });
  component.selectedCodes = ['cash.access'];
  spyOn(component.saveRequested, 'emit');
  component.submit();
  expect(component.saveRequested.emit).toHaveBeenCalledWith({
    name: 'Caja tarde',
    description: 'Turno tarde',
    permissionCodes: ['cash.access']
  });
});
```

- [ ] **Step 2: Run focused spec and verify RED**

Expected: compilation fails because the profile panel does not exist.

- [ ] **Step 3: Implement the panel with PermissionMatrixComponent**

Inputs: `mode`, `profile`, `permissionCatalog`, `usageCount`, `saving`; outputs: `saveRequested`, `closeRequested`. Use the existing name and description validators. Require at least one selected permission. Emit dirty state on close.

```ts
@Input({ required: true }) mode!: Exclude<AccessPanelMode, 'closed'>;
@Input() profile: AccessProfileResponse | null = null;
@Input() permissionCatalog = PermissionCatalog;
@Input() usageCount = 0;
@Input() saving = false;
@Output() saveRequested = new EventEmitter<AccessProfileDraft>();
@Output() closeRequested = new EventEmitter<boolean>();
readonly form = this.fb.group({
  name: ['', [Validators.required, Validators.maxLength(120)]],
  description: ['', [Validators.maxLength(500)]]
});
selectedCodes: string[] = [];
initialCodesKey = '';
private loadedKey = '';

ngOnChanges(): void {
  const key = `${this.mode}:${this.profile?.id ?? 'new'}`;
  if (key === this.loadedKey) return;
  this.loadedKey = key;
  this.form.reset({ name: this.profile?.name ?? '', description: this.profile?.description ?? '' });
  this.selectedCodes = [...(this.profile?.permissionCodes ?? [])];
  this.initialCodesKey = [...this.selectedCodes].sort().join('|');
}

get permissionsDirty(): boolean {
  return [...this.selectedCodes].sort().join('|') !== this.initialCodesKey;
}

requestClose(): void {
  this.closeRequested.emit(this.form.dirty || this.permissionsDirty);
}

submit(): void {
  if (this.form.invalid || this.selectedCodes.length === 0) {
    this.form.markAllAsTouched();
    return;
  }
  const raw = this.form.getRawValue();
  this.saveRequested.emit({
    name: String(raw.name ?? '').trim(),
    description: String(raw.description ?? '').trim() || null,
    permissionCodes: [...this.selectedCodes]
  });
}
```

```html
<aside class="access-panel access-panel--profile" role="dialog" aria-modal="true">
  <header><h2>{{ mode === 'create' ? 'Nuevo perfil' : 'Editar ' + profile?.name }}</h2>
    <span *ngIf="mode === 'edit'">{{ usageCount }} usuarios afectados</span></header>
  <form [formGroup]="form" (ngSubmit)="submit()">
    <div class="access-panel__body">
      <input formControlName="name" placeholder="Nombre" />
      <textarea formControlName="description" placeholder="Propósito operativo"></textarea>
      <app-permission-matrix [permissions]="permissionCatalog" [selectedCodes]="selectedCodes"
        (selectedCodesChange)="selectedCodes = $event"></app-permission-matrix>
    </div>
    <footer><button type="button" (click)="requestClose()">Cancelar</button>
      <button type="submit" [disabled]="saving">{{ saving ? 'Guardando...' : 'Guardar perfil' }}</button></footer>
  </form>
</aside>
```

- [ ] **Step 4: Implement wide responsive panel**

Use a `560px` desktop width, full viewport width below `900px`, fixed header/footer and independently scrolling body. Show usage count in edit mode and no technical codes.

- [ ] **Step 5: Run tests and commit**

```powershell
git add src/app/features/users/components/access-profile-panel
git commit -m "feat(users): add contextual profile editor"
```

### Task 8: Integrate Profiles and remove the legacy workspace

**Files:**
- Modify: `src/app/features/users/users.component.ts`
- Modify: `src/app/features/users/users.component.html`
- Modify: `src/app/features/users/users.component.css`
- Modify: `src/app/features/users/users.component.spec.ts`

- [ ] **Step 1: Write failing integration tests**

```ts
it('preserves list state while switching between users and profiles', () => {
  component.activeSection = 'users';
  component.selectSection('profiles');
  component.selectSection('users');
  expect(component.activeSection).toBe('users');
  expect(fixture.nativeElement.querySelector('app-user-access-list')).not.toBeNull();
});

it('derives profile usage and keeps an errored profile editor open', () => {
  accessProfileService.updateAccessProfile.and.returnValue(throwError(() => ({ error: { message: 'falló' } })));
  component.openProfileEditor(profile);
  component.saveProfileDraft({ name: 'Admin', description: null, permissionCodes: ['sales.access'] });
  expect(component.profilePanelMode).toBe('edit');
  expect(component.profileUsage(profile.id)).toBe(1);
});
```

- [ ] **Step 2: Run the integration spec and verify RED**

Expected: compilation fails because the profile panel state and new child components are absent.

- [ ] **Step 3: Wire profile catalog and panel**

Add `profilePanelMode`, `selectedProfile`, `profilePanelSaving`, `openProfileCreator`, `openProfileEditor`, `saveProfileDraft`, `requestProfilePanelClose` and `profileUsage`. Reuse current create/update/delete service calls, `reloadUsers()` and `auth.refreshCurrentUserProfile()`.

```ts
profilePanelMode: AccessPanelMode = 'closed';
selectedProfile: AccessProfileResponse | null = null;
profilePanelSaving = false;

openProfileCreator(): void {
  this.selectedProfile = null;
  this.profilePanelMode = 'create';
}

openProfileEditor(profile: AccessProfileResponse): void {
  this.selectedProfile = profile;
  this.profilePanelMode = 'edit';
}

profileUsage(profileId: string): number {
  return profileUsageCount(profileId, this.users);
}

async requestProfilePanelClose(dirty: boolean): Promise<void> {
  if (dirty && !await this.confirmation.confirm({
    eyebrow: 'Cambios sin guardar',
    title: 'Cerrar edición de perfil',
    message: 'Los cambios del perfil se perderán.',
    confirmLabel: 'Descartar cambios',
    tone: 'warning'
  })) return;
  this.profilePanelMode = 'closed';
  this.selectedProfile = null;
}

saveProfileDraft(draft: AccessProfileDraft): void {
  this.profilePanelSaving = true;
  const id = this.selectedProfile?.id;
  const action = id
    ? this.accessProfileService.updateAccessProfile(id, draft)
    : this.accessProfileService.createAccessProfile(draft);
  action.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
    next: profile => {
      this.profiles = [...this.profiles.filter(item => item.id !== profile.id), profile]
        .sort((a, b) => a.name.localeCompare(b.name));
      this.profilePanelSaving = false;
      this.profilePanelMode = 'closed';
      this.selectedProfile = null;
      this.reloadUsers();
      this.auth.refreshCurrentUserProfile();
      this.cdr.markForCheck();
    },
    error: err => {
      this.profilePanelSaving = false;
      this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo guardar el perfil');
      this.cdr.markForCheck();
    }
  });
}
```

- [ ] **Step 4: Replace legacy Profiles markup and state**

Render `<app-access-profile-list>` and conditional `<app-access-profile-panel>`. Remove the legacy collapsed cards, category chips and permanent profile form. Remove `collapsedUserIds`, `collapsedProfileIds`, `activePermissionCategory`, `permissionSearchTerm`, `showSelectedPermissionsOnly`, `editingProfileId`, `selectedProfilePermissionCodes`, `expandedPermissionModules`, `toggleUserCollapse`, `toggleProfileCollapse`, `selectPermissionCategory`, `togglePermissionModule`, `togglePermissionModuleSelection` and `clearPermissionModuleSelection` after their template references disappear.

```html
<section [hidden]="activeSection !== 'profiles'">
  <app-access-profile-list [profiles]="profiles" [users]="users" [loading]="loadingProfiles"
    [selectedProfileId]="selectedProfile?.id ?? null"
    (createRequested)="openProfileCreator()" (profileSelected)="openProfileEditor($event)"
    (deleteRequested)="deleteProfile($event)"></app-access-profile-list>
</section>
<app-access-profile-panel *ngIf="profilePanelMode !== 'closed'" [mode]="$any(profilePanelMode)"
  [profile]="selectedProfile" [usageCount]="selectedProfile ? profileUsage(selectedProfile.id) : 0"
  [saving]="profilePanelSaving" (saveRequested)="saveProfileDraft($event)"
  (closeRequested)="requestProfilePanelClose($event)">
</app-access-profile-panel>
```
- [ ] **Step 5: Consolidate page-level styling**

Keep shell, hero, tabs and panel backdrop rules in `users.component.css`; component-specific styles stay beside each child. Verify no horizontal overflow at `1280px`, `768px` and `375px`. Add `prefers-reduced-motion`.

```css
.page { width:min(100%, 1440px); margin:0 auto; padding:clamp(1rem,2vw,2rem); }
.access-tabs { display:flex; gap:.35rem; border-bottom:1px solid var(--border); }
.access-tabs [role="tab"] { min-height:44px; padding:.75rem 1rem; border:0; background:transparent; }
.access-tabs [aria-selected="true"] { color:var(--text); box-shadow:inset 0 -2px var(--amber); }
[hidden] { display:none !important; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior:auto !important; transition:none !important; animation:none !important; }
}
```
- [ ] **Step 6: Run focused and full tests, then commit**

```powershell
npm test -- --watch=false --browsers=ChromeHeadless --include="**/users.component.spec.ts"
npm test -- --watch=false --browsers=ChromeHeadless
git add src/app/features/users
git commit -m "feat(users): complete users and profiles redesign"
```

### Task 9: Final verification and visual review

**Files:**
- Modify only if verification exposes a scoped defect.

- [ ] **Step 1: Run all automated verification**

```powershell
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
git diff --check
```

Expected: all tests and build exit `0`; only pre-existing build warnings remain.

- [ ] **Step 2: Review the live page**

Start or reuse the Angular dev server and inspect `/users` at:

- desktop `1280 × 800`;
- tablet `768 × 1024`;
- phone `375 × 812`.

Verify:

- Users is the initial tab and the list dominates.
- Search and filters do not shift layout.
- User and profile panels scroll internally and keep their footer visible.
- Keyboard focus enters and returns from the panel.
- Permission codes are absent from normal UI.
- No horizontal overflow or clipped actions.

- [ ] **Step 3: Record final evidence**

```powershell
git status --short
git log --oneline --max-count=10
```

Expected: worktree clean and one focused commit per completed task.
