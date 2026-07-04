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

  afterEach(() => {
    document.body.classList.remove('theme-light');
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

  it('keeps a pristine invalid submit pristine and reports a pristine close', () => {
    render('create');
    const close = jasmine.createSpy('close');
    component.closeRequested.subscribe(close);

    component.submit();
    component.requestClose();

    expect(component.form.pristine).toBeTrue();
    expect(close).toHaveBeenCalledOnceWith(false);
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

  it('communicates the required profile visibly without unsupported aria-required on the group', () => {
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
    expect(group?.getAttribute('aria-required')).toBeNull();
    expect(query('#profile-label')?.textContent).toContain('(obligatorio)');
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute('aria-label')).toBe('Perfil de acceso: Seleccioná un perfil');
    expect(trigger?.getAttribute('aria-describedby')).toBe('profile-error');
    expect(trigger?.getAttribute('aria-required')).toBeNull();
    expect(error?.textContent).toContain('Seleccioná un perfil');
  });

  it('reports pristine close as false and form or branch changes as dirty', () => {
    render('create');
    const close = jasmine.createSpy('close');
    component.closeRequested.subscribe(close);

    component.requestClose();
    expect(close).toHaveBeenCalledOnceWith(false);

    component.form.controls.username.setValue('nuevo.usuario');
    component.form.controls.username.markAsDirty();
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
    component.form.controls.profileId.markAsDirty();
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

  it('refreshes same-ID user inputs while pristine and preserves a dirty draft', () => {
    render('edit', existingUser);
    fixture.componentRef.setInput('user', {
      ...existingUser,
      username: 'ana.actualizada',
      profileId: 'supervision',
      branchIds: ['center']
    });
    fixture.detectChanges();

    expect(component.form.controls.profileId.value).toBe('supervision');
    expect(component.selectedBranchIds).toEqual(new Set(['center']));

    component.form.controls.profileId.setValue('operations');
    component.form.controls.profileId.markAsDirty();
    component.toggleBranch('north');
    fixture.componentRef.setInput('user', {
      ...existingUser,
      profileId: 'supervision',
      branchIds: []
    });
    fixture.detectChanges();

    expect(component.form.controls.profileId.value).toBe('operations');
    expect(component.selectedBranchIds).toEqual(new Set(['center', 'north']));
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

  it('traps forward and backward focus, makes background inert, then restores both on destroy', fakeAsync(() => {
    fixture = TestBed.createComponent(UserAccessPanelComponent);
    component = fixture.componentInstance;
    setInputs('create');
    const overlayRoot = document.createElement('div');
    const overlayBranch = document.createElement('div');
    const background = document.createElement('button');
    background.type = 'button';
    background.textContent = 'Background action';
    overlayRoot.append(background, overlayBranch);
    overlayBranch.appendChild(fixture.nativeElement);
    document.body.appendChild(overlayRoot);
    background.focus();

    fixture.detectChanges();
    tick();
    expect(background.inert).toBeTrue();

    const first = query('.access-panel__close') as HTMLButtonElement;
    const last = query('.access-panel__button--primary') as HTMLButtonElement;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true
    }));
    expect(document.activeElement).toBe(last);

    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true
    }));
    expect(document.activeElement).toBe(first);

    fixture.destroy();
    expect(background.inert).toBeFalse();
    expect(document.activeElement).toBe(background);
    overlayRoot.remove();
  }));

  it('lets an open profile select own the first Escape and closes the panel on the next Escape', fakeAsync(() => {
    render('create');
    const close = jasmine.createSpy('close');
    component.closeRequested.subscribe(close);
    const trigger = query('.search-select__trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    tick();

    const filter = query('.search-select__input') as HTMLInputElement;
    filter.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    }));
    tick();
    fixture.detectChanges();

    expect(close).not.toHaveBeenCalled();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(close).toHaveBeenCalledOnceWith(false);
  }));

  it('blocks submit, close and branch mutation while saving, then restores mode controls', () => {
    render('create');
    component.form.setValue({
      username: 'operador',
      email: 'operador@empresa.test',
      password: 'secreto',
      profileId: 'operations'
    });
    const save = jasmine.createSpy('save');
    const close = jasmine.createSpy('close');
    component.saveRequested.subscribe(save);
    component.closeRequested.subscribe(close);

    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    const branchesBefore = component.selectedBranchIds;
    component.submit();
    component.submit();
    component.requestClose();
    (query('.access-panel__backdrop') as HTMLElement).click();
    (query('.access-panel__close') as HTMLButtonElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    component.toggleBranch('north');
    component.selectAllBranches();

    expect(save).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(component.selectedBranchIds).toBe(branchesBefore);
    expect(component.form.disabled).toBeTrue();
    expect((query('.search-select__trigger') as HTMLButtonElement).disabled).toBeTrue();
    expect((query('[data-testid="all-branches"]') as HTMLButtonElement).disabled).toBeTrue();
    expect((query('.access-panel__branch input') as HTMLInputElement).disabled).toBeTrue();
    expect((query('.access-panel__close') as HTMLButtonElement).disabled).toBeTrue();

    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
    expect(component.form.controls.username.enabled).toBeTrue();
    expect(component.form.controls.email.enabled).toBeTrue();
    expect(component.form.controls.password.enabled).toBeTrue();
    expect(component.form.controls.profileId.enabled).toBeTrue();
    expect((query('.search-select__trigger') as HTMLButtonElement).disabled).toBeFalse();

    render('edit', existingUser);
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
    expect(component.form.controls.username.disabled).toBeTrue();
    expect(component.form.controls.email.disabled).toBeTrue();
    expect(component.form.controls.password.disabled).toBeTrue();
    expect(component.form.controls.profileId.enabled).toBeTrue();
  });

  it('uses a pressed all-branches control instead of a misleading checkbox', () => {
    render('create');
    let allBranches = query('[data-testid="all-branches"]') as HTMLButtonElement;
    expect(allBranches.tagName).toBe('BUTTON');
    expect(allBranches.getAttribute('aria-pressed')).toBe('true');

    component.toggleBranch('north');
    fixture.detectChanges();
    allBranches = query('[data-testid="all-branches"]') as HTMLButtonElement;
    expect(allBranches.getAttribute('aria-pressed')).toBe('false');

    allBranches.click();
    fixture.detectChanges();
    expect(component.selectedBranchIds).toEqual(new Set());
    expect(allBranches.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps light-theme primary action text above WCAG AA contrast', () => {
    document.body.classList.add('theme-light');
    render('create');
    const primary = query('.access-panel__button--primary') as HTMLButtonElement;
    const style = getComputedStyle(primary);

    expect(contrastRatio(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
  });

  it('uses 720px desktop width, full host width through 900px, touch targets and no narrow overflow', async () => {
    render('edit', {
      ...existingUser,
      email: `${'verylongunbrokenaddress'.repeat(12)}@empresa.test`
    });

    await setHostWidth(1000);
    let panel = query('.access-panel') as HTMLElement;
    let body = query('.access-panel__body') as HTMLElement;
    const profileTrigger = query('.search-select__trigger') as HTMLButtonElement;
    expect(panel.getBoundingClientRect().width).toBeCloseTo(720, 0);
    expect(parseFloat(getComputedStyle(body).paddingLeft)).toBeGreaterThanOrEqual(28);
    expect(getComputedStyle(profileTrigger).borderTopLeftRadius).toBe('8px');

    await setHostWidth(900);
    panel = query('.access-panel') as HTMLElement;
    expect(fixture.nativeElement.getBoundingClientRect().width).toBeCloseTo(900, 0);
    expect(panel.getBoundingClientRect().width).toBeCloseTo(900, 0);

    await setHostWidth(375);
    panel = query('.access-panel') as HTMLElement;
    body = query('.access-panel__body') as HTMLElement;
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
    expect(getComputedStyle(identityInput).borderTopLeftRadius).toBe('8px');
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
    setInputs(mode, selectedUser);
    fixture.detectChanges();
  }

  function setInputs(
    mode: 'create' | 'edit',
    selectedUser: UserResponse | null = null
  ): void {
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('user', selectedUser);
    fixture.componentRef.setInput('profiles', profiles);
    fixture.componentRef.setInput('branches', branches);
    fixture.componentRef.setInput('permissionCatalog', [
      { code: 'sales.access', label: 'Ventas: acceso', description: 'Puede consultar ventas.' },
      { code: 'cash.open', label: 'Caja: abrir', description: 'Puede abrir la caja.' },
      { code: 'reports.audit', label: 'Reportería: auditoría', description: 'Puede auditar.' }
    ]);
  }

  function query(selector: string): Element | null {
    return fixture.nativeElement.querySelector(selector);
  }

  async function setHostWidth(width: number): Promise<void> {
    fixture.nativeElement.style.width = `${width}px`;
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    fixture.detectChanges();
  }

  function contrastRatio(foreground: string, background: string): number {
    const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
    const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
    return (lighter + 0.05) / (darker + 0.05);
  }

  function relativeLuminance(color: string): number {
    const channelRange = color.startsWith('color(srgb') ? 1 : 255;
    const channels = (color.match(/\d+(?:\.\d+)?/g) ?? [])
      .slice(0, 3)
      .map(value => Number(value) / channelRange)
      .map(value => value <= 0.03928
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4));

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
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
