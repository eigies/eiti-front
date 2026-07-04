import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';

import { AccessProfileResponse } from '../../../../core/models/access-profile.models';
import { BranchResponse } from '../../../../core/models/branch.models';
import { UserResponse } from '../../../../core/models/user.models';
import { UserAccessPanelComponent } from './user-access-panel.component';

describe('UserAccessPanelComponent', () => {
  let fixture: ComponentFixture<UserAccessPanelComponent>;
  let component: UserAccessPanelComponent;

  const profiles: AccessProfileResponse[] = [
    profile('operations', 'Operaciones', ['sales.access', 'cash.open']),
    profile('supervision', 'Supervisión', ['reports.audit'])
  ];
  const branches: BranchResponse[] = [
    branch('north', 'Sucursal Norte', 'NTE'),
    branch('center', 'Casa Central', 'CTR')
  ];
  const existingUser: UserResponse = user({
    id: 'user-7',
    username: '  ana.perez  ',
    email: '  ana@empresa.test  ',
    employeeName: 'Ana Pérez',
    profileId: 'operations',
    profileName: 'Operaciones',
    branchIds: ['north']
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserAccessPanelComponent]
    }).compileComponents();
  });

  it('shows create identity fields, while edit hides them and presents the exact user identity', () => {
    render('create');

    expect(query('[data-testid="create-identity"]')).not.toBeNull();
    expect(query('input[formControlName="username"]')).not.toBeNull();
    expect(query('input[formControlName="email"]')).not.toBeNull();
    expect(query('input[formControlName="password"]')).not.toBeNull();
    expect(query('[data-testid="edit-identity"]')).toBeNull();

    render('edit', existingUser);

    expect(query('[data-testid="create-identity"]')).toBeNull();
    const identity = query('[data-testid="edit-identity"]') as HTMLElement;
    expect(identity.textContent).toContain('ana.perez');
    expect(identity.textContent).toContain('ana@empresa.test');
    expect(identity.textContent).toContain('Ana Pérez');
    expect(query('input[formControlName="username"]')).toBeNull();
  });

  it('rejects an invalid create draft and lets edit ignore blank identity while still requiring a profile', () => {
    render('create');
    const createSave = jasmine.createSpy('createSave');
    component.saveRequested.subscribe(createSave);

    component.submit();

    expect(createSave).not.toHaveBeenCalled();
    expect(component.form.controls.username.touched).toBeTrue();
    expect(component.form.controls.email.touched).toBeTrue();
    expect(component.form.controls.password.touched).toBeTrue();
    expect(component.form.controls.profileId.touched).toBeTrue();

    render('edit', { ...existingUser, profileId: null });
    const editSave = jasmine.createSpy('editSave');
    component.saveRequested.subscribe(editSave);
    component.form.controls.username.setValue('');
    component.form.controls.email.setValue('');
    component.form.controls.password.setValue('');

    component.submit();
    expect(editSave).not.toHaveBeenCalled();
    expect(component.form.controls.profileId.touched).toBeTrue();

    component.form.controls.profileId.setValue('supervision');
    component.submit();

    expect(component.form.controls.username.disabled).toBeTrue();
    expect(component.form.controls.email.disabled).toBeTrue();
    expect(component.form.controls.password.disabled).toBeTrue();
    expect(editSave).toHaveBeenCalledTimes(1);
  });

  it('emits an exact normalized profile and branch draft', () => {
    render('create');
    const save = jasmine.createSpy('save');
    component.saveRequested.subscribe(save);
    component.form.setValue({
      username: '  operador.norte  ',
      email: '  norte@empresa.test  ',
      password: 'clave segura',
      profileId: 'operations'
    });
    component.toggleBranch('center');
    component.toggleBranch('north');

    component.submit();

    expect(save).toHaveBeenCalledOnceWith({
      username: 'operador.norte',
      email: 'norte@empresa.test',
      password: 'clave segura',
      profileId: 'operations',
      branchIds: ['north', 'center']
    });
  });

  it('emits an empty branch list for all branches and explicit IDs for restricted access', () => {
    render('create');
    const save = jasmine.createSpy('save');
    component.saveRequested.subscribe(save);
    component.form.setValue({
      username: 'operador',
      email: 'operador@empresa.test',
      password: 'secreto',
      profileId: 'operations'
    });

    expect(component.allBranchesSelected).toBeTrue();
    component.submit();
    expect(save.calls.mostRecent().args[0].branchIds).toEqual([]);

    component.toggleBranch('north');
    component.toggleBranch('center');
    component.submit();
    expect(save.calls.mostRecent().args[0].branchIds).toEqual(['north', 'center']);

    component.selectAllBranches();
    component.submit();
    expect(save.calls.mostRecent().args[0].branchIds).toEqual([]);
  });

  it('summarizes inherited permissions with friendly modules and actions, never raw codes', () => {
    render('create');
    component.form.controls.profileId.setValue('operations');
    fixture.detectChanges();

    const summary = query('.access-panel__permissions') as HTMLElement;
    expect(summary.textContent).toContain('2 permisos heredados');
    expect(summary.textContent).toContain('Ventas');
    expect(summary.textContent).toContain('Caja');
    expect(summary.textContent).toContain('acceso');
    expect(summary.textContent).toContain('abrir');
    expect(summary.textContent).not.toContain('sales.access');
    expect(summary.textContent).not.toContain('cash.open');
  });

  it('associates the profile group, label and error with the searchable select trigger', () => {
    render('create');
    component.form.controls.profileId.markAsTouched();
    component.form.controls.profileId.setValue('');
    fixture.detectChanges();

    const group = query('.access-panel__profile-group') as HTMLElement | null;
    const trigger = query('app-searchable-select .search-select__trigger') as HTMLButtonElement | null;
    const error = query('#profile-error') as HTMLElement | null;

    expect(group).not.toBeNull();
    expect(group?.getAttribute('role')).toBe('group');
    expect(group?.getAttribute('aria-labelledby')).toBe('profile-label');
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute('aria-labelledby')).toBe('profile-label');
    expect(trigger?.getAttribute('aria-describedby')).toBe('profile-error');
    expect(error?.textContent).toContain('Seleccioná un perfil');
  });

  it('reports pristine close as false and form or branch changes as dirty', () => {
    render('create');
    const close = jasmine.createSpy('close');
    component.closeRequested.subscribe(close);

    component.requestClose();
    expect(close).toHaveBeenCalledOnceWith(false);

    component.form.controls.username.setValue('nuevo.usuario');
    component.requestClose();
    expect(close.calls.mostRecent().args).toEqual([true]);

    render('create');
    const branchClose = jasmine.createSpy('branchClose');
    component.closeRequested.subscribe(branchClose);
    component.toggleBranch('north');
    component.requestClose();
    expect(branchClose).toHaveBeenCalledOnceWith(true);
  });

  it('does not reset a dirty draft when only saving changes', () => {
    render('edit', existingUser);
    component.form.controls.profileId.setValue('supervision');
    component.toggleBranch('center');
    const selectedBefore = component.selectedBranchIds;

    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();

    expect(component.form.controls.profileId.value).toBe('supervision');
    expect(component.form.dirty).toBeTrue();
    expect(component.selectedBranchIds).toBe(selectedBefore);
    expect(component.selectedBranchIds).toEqual(new Set(['north', 'center']));
    expect(component.isDirty).toBeTrue();
  });

  it('requests close on Escape and exposes an initially focused, named modal dialog', fakeAsync(() => {
    render('create');
    const close = jasmine.createSpy('close');
    component.closeRequested.subscribe(close);
    tick();

    const panel = query('.access-panel') as HTMLElement;
    const title = query('#user-access-panel-title') as HTMLElement;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.getAttribute('aria-labelledby')).toBe('user-access-panel-title');
    expect(title.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(title);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(close).toHaveBeenCalledOnceWith(false);
  }));

  it('uses 440px desktop width, full host width through 900px, touch targets and no narrow overflow', async () => {
    render('edit', {
      ...existingUser,
      email: `${'verylongunbrokenaddress'.repeat(12)}@empresa.test`
    });

    await setHostWidth(1000);
    let panel = query('.access-panel') as HTMLElement;
    expect(panel.getBoundingClientRect().width).toBeCloseTo(440, 0);

    await setHostWidth(900);
    panel = query('.access-panel') as HTMLElement;
    expect(fixture.nativeElement.getBoundingClientRect().width).toBeCloseTo(900, 0);
    expect(panel.getBoundingClientRect().width).toBeCloseTo(900, 0);

    await setHostWidth(375);
    panel = query('.access-panel') as HTMLElement;
    const body = query('.access-panel__body') as HTMLElement;
    expect(query('.access-panel__header')).not.toBeNull();
    expect(body).not.toBeNull();
    expect(query('.access-panel__footer')).not.toBeNull();
    expect(panel.getBoundingClientRect().width).toBeCloseTo(375, 0);
    expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
    expect(getComputedStyle(body).overflowY).toBe('auto');
    for (const selector of [
      '.access-panel__close',
      '.search-select__trigger',
      '.access-panel__branch',
      '.access-panel__button'
    ]) {
      const target = query(selector) as HTMLElement;
      expect(Number.parseFloat(getComputedStyle(target).minHeight))
        .withContext(`${selector} touch target`)
        .toBeGreaterThanOrEqual(44);
    }

    render('create');
    await setHostWidth(375);
    const identityInput = query('.access-panel__field input') as HTMLInputElement;
    expect(Number.parseFloat(getComputedStyle(identityInput).minHeight))
      .withContext('identity input touch target')
      .toBeGreaterThanOrEqual(44);
    expect((query('.access-panel') as HTMLElement).scrollWidth)
      .toBeLessThanOrEqual((query('.access-panel') as HTMLElement).clientWidth);
  });

  it('disables panel motion when the user requests reduced motion', () => {
    render('create');
    const componentStyles = Array.from(document.head.querySelectorAll('style'))
      .map(style => style.textContent ?? '')
      .find(css => css.includes('.access-panel__backdrop') && css.includes('prefers-reduced-motion'));

    expect(componentStyles).toBeDefined();
    expect(componentStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(componentStyles).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*\.access-panel[^{]*\{[^}]*animation:\s*none/
    );
  });

  function render(
    mode: 'create' | 'edit',
    selectedUser: UserResponse | null = null
  ): void {
    fixture = TestBed.createComponent(UserAccessPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('user', selectedUser);
    fixture.componentRef.setInput('profiles', profiles);
    fixture.componentRef.setInput('branches', branches);
    fixture.componentRef.setInput('permissionCatalog', [
      { code: 'sales.access', label: 'Ventas: acceso', description: 'Puede consultar ventas.' },
      { code: 'cash.open', label: 'Caja: abrir', description: 'Puede abrir la caja.' },
      { code: 'reports.audit', label: 'Reportería: auditoría', description: 'Puede auditar.' }
    ]);
    fixture.detectChanges();
  }

  function query(selector: string): Element | null {
    return fixture.nativeElement.querySelector(selector);
  }

  async function setHostWidth(width: number): Promise<void> {
    fixture.nativeElement.style.width = `${width}px`;
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    fixture.detectChanges();
  }

  function profile(
    id: string,
    name: string,
    permissionCodes: string[]
  ): AccessProfileResponse {
    return {
      id,
      name,
      description: null,
      permissionCodes,
      isSystem: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };
  }

  function branch(id: string, name: string, code: string): BranchResponse {
    return {
      id,
      name,
      code,
      address: null,
      salesCount: 0,
      cashValue: 0,
      createdAt: '2026-01-01T00:00:00Z'
    };
  }

  function user(overrides: Partial<UserResponse>): UserResponse {
    return {
      id: 'user',
      username: 'usuario',
      email: 'usuario@empresa.test',
      isActive: true,
      employeeId: null,
      employeeName: null,
      profileId: null,
      profileName: null,
      permissions: [],
      branchIds: [],
      createdAt: '2026-01-01T00:00:00Z',
      lastLoginAt: null,
      ...overrides
    };
  }
});
