import { By } from '@angular/platform-browser';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { AccessProfileResponse } from '../../core/models/access-profile.models';
import { BranchResponse } from '../../core/models/branch.models';
import { UserResponse } from '../../core/models/user.models';
import { AccessProfileService } from '../../core/services/access-profile.service';
import { AuthService } from '../../core/services/auth.service';
import { BranchService } from '../../core/services/branch.service';
import { UserService } from '../../core/services/user.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';
import { ToastService } from '../../shared/services/toast.service';
import { AccessProfileDraft, UserAccessDraft } from './users-ui.models';
import { AccessProfileListComponent } from './components/access-profile-list/access-profile-list.component';
import { UserAccessListComponent } from './components/user-access-list/user-access-list.component';
import { UserAccessPanelComponent } from './components/user-access-panel/user-access-panel.component';
import { UsersComponent } from './users.component';

describe('UsersComponent', () => {
  let fixture: ComponentFixture<UsersComponent>;
  let component: UsersComponent;
  let userService: jasmine.SpyObj<UserService>;
  let profileService: jasmine.SpyObj<AccessProfileService>;
  let branchService: jasmine.SpyObj<BranchService>;
  let toast: jasmine.SpyObj<ToastService>;
  let auth: jasmine.SpyObj<AuthService>;
  let confirmation: jasmine.SpyObj<ConfirmationService>;

  const profiles = [
    profile('profile-b', 'Supervisión'),
    profile('profile-a', 'Operaciones')
  ];
  const branches = [
    branch('branch-a', 'Casa Central'),
    branch('branch-b', 'Sucursal Norte')
  ];
  const users = [
    user({ id: 'user-b', username: 'zoe', profileId: 'profile-b', employeeId: 'employee-7' }),
    user({ id: 'user-a', username: 'ana', profileId: 'profile-a', branchIds: ['branch-a'] })
  ];

  beforeEach(async () => {
    userService = jasmine.createSpyObj<UserService>('UserService', [
      'listUsers',
      'createUser',
      'updateProfile',
      'setStatus'
    ]);
    profileService = jasmine.createSpyObj<AccessProfileService>('AccessProfileService', [
      'listAccessProfiles',
      'createAccessProfile',
      'updateAccessProfile',
      'deleteAccessProfile'
    ]);
    branchService = jasmine.createSpyObj<BranchService>('BranchService', ['listBranches']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['refreshCurrentUserProfile']);
    confirmation = jasmine.createSpyObj<ConfirmationService>('ConfirmationService', ['confirm']);

    userService.listUsers.and.returnValue(of([...users]));
    profileService.listAccessProfiles.and.returnValue(of([...profiles]));
    branchService.listBranches.and.returnValue(of([...branches]));
    confirmation.confirm.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [UsersComponent],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: AccessProfileService, useValue: profileService },
        { provide: BranchService, useValue: branchService },
        { provide: ToastService, useValue: toast },
        { provide: AuthService, useValue: auth },
        { provide: ConfirmationService, useValue: confirmation }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    document.body.classList.remove('theme-light');
    fixture?.destroy();
  });

  it('starts in Usuarios with the new list and no panel or permanent create form', () => {
    render();

    expect(component.activeSection).toBe('users');
    const list = listComponent();
    expect(list).not.toBeNull();
    expect(list?.users.map(item => item.username)).toEqual(['ana', 'zoe']);
    expect(list?.profiles.map(item => item.name)).toEqual(['Operaciones', 'Supervisión']);
    expect(list?.branches).toEqual(branches);
    expect(panelComponent()).toBeNull();
    expect(query('.panel--create')).toBeNull();
    expect(query('form [formControlName="username"]')).toBeNull();
  });

  it('opens create and edit panels with the exact mode and selected user', () => {
    render();
    const createTrigger = document.createElement('button');
    document.body.appendChild(createTrigger);
    createTrigger.focus();

    listComponent()?.createRequested.emit();
    fixture.detectChanges();

    expect(component.userPanelMode).toBe('create');
    expect(component.selectedUser).toBeNull();
    expect(panelComponent()?.mode).toBe('create');
    expect(panelComponent()?.user).toBeNull();

    component.requestUserPanelClose(false);
    fixture.detectChanges();
    const selected = component.users[1];
    listComponent()?.userSelected.emit(selected);
    fixture.detectChanges();

    expect(component.userPanelMode).toBe('edit');
    expect(component.selectedUser).toBe(selected);
    expect(panelComponent()?.mode).toBe('edit');
    expect(panelComponent()?.user).toBe(selected);

    createTrigger.remove();
  });

  it('creates with the exact request, patches and sorts the list, then closes', () => {
    const created = user({ id: 'created', username: 'beto', profileId: 'profile-a' });
    userService.createUser.and.returnValue(of(created));
    render();
    component.openUserCreator();
    const draft = accessDraft({ username: 'beto' });

    component.saveUserDraft(draft);

    expect(userService.createUser).toHaveBeenCalledOnceWith({
      ...draft,
      employeeId: null
    });
    expect(component.users.map(item => item.username)).toEqual(['ana', 'beto', 'zoe']);
    expect(component.userPanelMode).toBe('closed');
    expect(component.selectedUser).toBeNull();
    expect(component.userPanelSaving).toBeFalse();
    expect(toast.success).toHaveBeenCalledOnceWith('Usuario creado');
    expect(auth.refreshCurrentUserProfile).not.toHaveBeenCalled();
  });

  it('focuses the created user edit action when the empty-state opener disappears', fakeAsync(() => {
    const created = user({ id: 'created', username: 'beto', profileId: 'profile-a' });
    userService.listUsers.and.returnValue(of([]));
    userService.createUser.and.returnValue(of(created));
    render();
    const emptyCreate = query('.user-list__empty--catalog button') as HTMLButtonElement;
    emptyCreate.focus();
    emptyCreate.click();
    fixture.detectChanges();
    tick();

    component.saveUserDraft(accessDraft({ username: 'beto' }));
    fixture.detectChanges();
    tick();

    const createdEdit = query(
      '[data-user-id="created"] .user-list__open'
    ) as HTMLButtonElement;
    expect(createdEdit).not.toBeNull();
    expect(document.activeElement).toBe(createdEdit);
  }));

  it('lets the panel restore a surviving opener exactly once on normal close', fakeAsync(() => {
    render();
    const createButton = query('.user-list__create') as HTMLButtonElement;
    createButton.focus();
    createButton.click();
    fixture.detectChanges();
    tick();
    const focus = spyOn(createButton, 'focus').and.callThrough();

    component.requestUserPanelClose(false);
    fixture.detectChanges();
    tick();

    expect(document.activeElement).toBe(createButton);
    expect(focus).toHaveBeenCalledTimes(1);
  }));

  it('edits with the exact preserved employee and draft access, patches the user, and refreshes auth', () => {
    const selected = users.find(item => item.employeeId === 'employee-7')!;
    const updated = user({
      ...selected,
      profileId: 'profile-a',
      profileName: 'Operaciones',
      branchIds: ['branch-a', 'branch-b']
    });
    userService.updateProfile.and.returnValue(of(updated));
    render();
    component.openUserEditor(component.users.find(item => item.id === selected.id)!);
    const draft = accessDraft({
      username: selected.username,
      email: selected.email,
      password: '',
      profileId: 'profile-a',
      branchIds: ['branch-a', 'branch-b']
    });

    component.saveUserDraft(draft);

    expect(userService.updateProfile).toHaveBeenCalledOnceWith(selected.id, {
      profileId: 'profile-a',
      employeeId: 'employee-7',
      branchIds: ['branch-a', 'branch-b']
    });
    expect(component.users.find(item => item.id === selected.id)).toEqual(updated);
    expect(component.userPanelMode).toBe('closed');
    expect(component.userPanelSaving).toBeFalse();
    expect(toast.success).toHaveBeenCalledOnceWith('Acceso actualizado');
    expect(auth.refreshCurrentUserProfile).toHaveBeenCalledTimes(1);
  });

  it('keeps the same create or edit panel open and clears saving after save errors', () => {
    userService.createUser.and.returnValue(throwError(() => ({
      error: { detail: 'Usuario duplicado' }
    })));
    userService.updateProfile.and.returnValue(throwError(() => ({
      error: { message: 'Perfil inválido' }
    })));
    render();

    component.openUserCreator();
    component.saveUserDraft(accessDraft());
    expect(component.userPanelMode).toBe('create');
    expect(component.selectedUser).toBeNull();
    expect(component.userPanelSaving).toBeFalse();
    expect(toast.error).toHaveBeenCalledWith('Usuario duplicado');

    const selected = component.users[0];
    component.openUserEditor(selected);
    component.saveUserDraft(accessDraft({ password: '' }));
    expect(component.userPanelMode).toBe('edit');
    expect(component.selectedUser).toBe(selected);
    expect(component.userPanelSaving).toBeFalse();
    expect(toast.error).toHaveBeenCalledWith('Perfil inválido');
  });

  it('confirms dirty close, keeps the panel on rejection, and closes directly when pristine', fakeAsync(() => {
    confirmation.confirm.and.resolveTo(false);
    render();
    component.openUserCreator();

    component.requestUserPanelClose(true);
    tick();

    expect(confirmation.confirm).toHaveBeenCalledTimes(1);
    expect(component.userPanelMode).toBe('create');

    confirmation.confirm.and.resolveTo(true);
    component.requestUserPanelClose(true);
    tick();
    expect(component.userPanelMode).toBe('closed');

    confirmation.confirm.calls.reset();
    component.openUserCreator();
    component.requestUserPanelClose(false);
    tick();
    expect(confirmation.confirm).not.toHaveBeenCalled();
    expect(component.userPanelMode).toBe('closed');
  }));

  it('ignores a dirty-close confirmation after the component is destroyed', fakeAsync(() => {
    const pending = deferred<boolean>();
    confirmation.confirm.and.returnValue(pending.promise);
    render();
    component.openUserCreator();

    component.requestUserPanelClose(true);
    fixture.destroy();
    pending.resolve(true);
    tick();

    expect(component.userPanelMode).toBe('create');
  }));

  it('ignores a stale dirty-close confirmation after another user is selected', fakeAsync(() => {
    const pending = deferred<boolean>();
    confirmation.confirm.and.returnValue(pending.promise);
    render();
    const first = component.users[0];
    const second = component.users[1];
    component.openUserEditor(first);

    component.requestUserPanelClose(true);
    component.openUserEditor(second);
    pending.resolve(true);
    tick();

    expect(component.userPanelMode).toBe('edit');
    expect(component.selectedUser).toBe(second);
  }));

  it('confirms deactivation but activates directly and calls setStatus with exact values', fakeAsync(() => {
    const active = user({ id: 'active', username: 'activo', isActive: true });
    const inactive = user({ id: 'inactive', username: 'inactivo', isActive: false });
    userService.setStatus.and.callFake((id, isActive) =>
      of(user({ id, username: id, isActive }))
    );
    render();
    component.users = [active, inactive];

    confirmation.confirm.and.resolveTo(false);
    component.requestUserStatusChange(active);
    tick();
    expect(userService.setStatus).not.toHaveBeenCalled();

    confirmation.confirm.and.resolveTo(true);
    component.requestUserStatusChange(active);
    tick();
    expect(userService.setStatus).toHaveBeenCalledWith('active', false);

    confirmation.confirm.calls.reset();
    component.requestUserStatusChange(inactive);
    tick();
    expect(confirmation.confirm).not.toHaveBeenCalled();
    expect(userService.setStatus).toHaveBeenCalledWith('inactive', true);
  }));

  it('ignores a stale deactivation confirmation after a newer status request', fakeAsync(() => {
    const pending = deferred<boolean>();
    const active = user({ id: 'active', username: 'activo', isActive: true });
    const inactive = user({ id: 'inactive', username: 'inactivo', isActive: false });
    confirmation.confirm.and.returnValue(pending.promise);
    userService.setStatus.and.callFake((id, isActive) =>
      of(user({ id, username: id, isActive }))
    );
    render();
    component.users = [active, inactive];

    component.requestUserStatusChange(active);
    component.requestUserStatusChange(inactive);
    pending.resolve(true);
    tick();

    expect(userService.setStatus).toHaveBeenCalledTimes(1);
    expect(userService.setStatus).toHaveBeenCalledOnceWith('inactive', true);
  }));

  it('does not delete a profile when its confirmation resolves after destroy', fakeAsync(() => {
    const pending = deferred<boolean>();
    confirmation.confirm.and.returnValue(pending.promise);
    render();
    const selectedProfile = component.profiles[0];

    component.deleteProfile(selectedProfile);
    fixture.destroy();
    pending.resolve(true);
    tick();

    expect(profileService.deleteAccessProfile).not.toHaveBeenCalled();
  }));

  it('uses accessible tabs and keeps both sections mounted with hidden semantics', () => {
    render();
    const tablist = query('[role="tablist"]');
    const tabs = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
    const usersSection = query('#users-panel') as HTMLElement;
    const profilesSection = query('#profiles-panel') as HTMLElement;

    expect(tablist).not.toBeNull();
    expect(tabs.map(tab => tab.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Usuarios · 2',
      'Perfiles · 2'
    ]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-controls')).toBe('users-panel');
    expect(usersSection.hidden).toBeFalse();
    expect(profilesSection.hidden).toBeTrue();
    expect(profilesSection.querySelector('app-access-profile-list')).not.toBeNull();

    tabs[1].click();
    fixture.detectChanges();

    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(usersSection.hidden).toBeTrue();
    expect(profilesSection.hidden).toBeFalse();
    expect(listComponent()).not.toBeNull();
  });

  it('preserves both list filter states while switching between users and profiles', () => {
    render();
    const usersList = listComponent();
    usersList?.setQuery('ana');
    component.selectSection('profiles');
    fixture.detectChanges();
    const profilesList = profileListComponent();
    profilesList?.setQuery('operaciones');

    component.selectSection('users');
    fixture.detectChanges();
    component.selectSection('profiles');
    fixture.detectChanges();

    expect(listComponent()).toBe(usersList);
    expect(listComponent()?.filters.query).toBe('ana');
    expect(profileListComponent()).toBe(profilesList);
    expect(profileListComponent()?.filters.query).toBe('operaciones');
  });

  it('derives profile usage and keeps an errored profile editor open', () => {
    profileService.updateAccessProfile.and.returnValue(throwError(() => ({
      error: { message: 'falló' }
    })));
    render();
    const selected = component.profiles.find(item => item.id === 'profile-a')!;
    component.openProfileEditor(selected);

    component.saveProfileDraft(profileDraft());

    expect(component.profilePanelMode).toBe('edit');
    expect(component.selectedProfile).toBe(selected);
    expect(component.profilePanelSaving).toBeFalse();
    expect(component.profileUsage(selected.id)).toBe(1);
    expect(toast.error).toHaveBeenCalledWith('falló');
  });

  it('moves focus and selection between both tabs with horizontal arrow keys', () => {
    render();
    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('[role="tab"]')
    ) as HTMLButtonElement[];
    tabs[0].focus();

    tabs[0].dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true
    }));
    fixture.detectChanges();

    expect(component.activeSection).toBe('profiles');
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');

    tabs[1].dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true
    }));
    fixture.detectChanges();

    expect(component.activeSection).toBe('users');
    expect(document.activeElement).toBe(tabs[0]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it('moves focus and selection to the first or last tab with Home and End', () => {
    render();
    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('[role="tab"]')
    ) as HTMLButtonElement[];
    tabs[0].focus();

    tabs[0].dispatchEvent(new KeyboardEvent('keydown', {
      key: 'End',
      bubbles: true
    }));
    fixture.detectChanges();
    expect(component.activeSection).toBe('profiles');
    expect(document.activeElement).toBe(tabs[1]);

    tabs[1].dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Home',
      bubbles: true
    }));
    fixture.detectChanges();
    expect(component.activeSection).toBe('users');
    expect(document.activeElement).toBe(tabs[0]);
  });

  it('keeps tabs touch-friendly, visibly focusable, and the shell free of narrow overflow', async () => {
    render();
    const tab = query('.access-tabs__item') as HTMLButtonElement;
    const tablist = query('.access-tabs') as HTMLElement;
    const componentStyles = Array.from(document.head.querySelectorAll('style'))
      .map(style => style.textContent ?? '')
      .find(css => css.includes('.access-tabs__item'));

    expect(Number.parseFloat(getComputedStyle(tab).minHeight)).toBeGreaterThanOrEqual(44);
    expect(componentStyles).toMatch(/\.access-tabs__item[^{]*:focus-visible[\s\S]*outline:/);
    expect(getComputedStyle(tablist).alignItems).toBe('flex-end');

    for (const width of [768, 375]) {
      fixture.nativeElement.style.display = 'block';
      fixture.nativeElement.style.width = `${width}px`;
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      fixture.detectChanges();
      const page = query('.page') as HTMLElement;
      expect(page.getBoundingClientRect().width).toBeLessThanOrEqual(width);
      expect(page.scrollWidth).toBeLessThanOrEqual(page.clientWidth);
      expect(fixture.nativeElement.scrollWidth)
        .toBeLessThanOrEqual(fixture.nativeElement.clientWidth);
    }
  });

  it('keeps inactive tab foreground above WCAG AA contrast in both themes', fakeAsync(() => {
    render();
    const inactiveTab = query('#profiles-tab') as HTMLButtonElement;

    expect(contrastRatio(
      getComputedStyle(inactiveTab).color,
      inheritedColorVariable('--bg')
    )).toBeGreaterThanOrEqual(4.5);

    inactiveTab.style.transition = 'none';
    document.body.classList.add('theme-light');
    tick(400);
    fixture.detectChanges();
    expect(contrastRatio(
      getComputedStyle(inactiveTab).color,
      inheritedColorVariable('--bg')
    )).toBeGreaterThanOrEqual(4.5);
  }));

  it('shows a persistent user error before the hidden list and retries users only', () => {
    userService.listUsers.and.returnValues(
      throwError(() => ({ error: { detail: 'Falló usuarios' } })),
      of([...users])
    );
    render();

    const error = query('[data-testid="users-load-error"]') as HTMLElement;
    const listHost = query('app-user-access-list') as HTMLElement;
    expect(error?.textContent).toContain('Falló usuarios');
    expect(error?.compareDocumentPosition(listHost) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(listHost.hidden).toBeTrue();

    (error?.querySelector('button') as HTMLButtonElement | null)?.click();
    fixture.detectChanges();

    expect(userService.listUsers).toHaveBeenCalledTimes(2);
    expect(profileService.listAccessProfiles).toHaveBeenCalledTimes(1);
    expect(query('[data-testid="users-load-error"]')).toBeNull();
    expect(listHost.hidden).toBeFalse();
  });

  it('shows a persistent profile error before the hidden catalog and retries profiles only', () => {
    profileService.listAccessProfiles.and.returnValues(
      throwError(() => ({ error: { message: 'Falló perfiles' } })),
      of([...profiles])
    );
    render();
    profileListComponent()?.setQuery('borrador conservado');
    component.selectSection('profiles');
    fixture.detectChanges();

    const error = query('[data-testid="profiles-load-error"]') as HTMLElement;
    const catalog = query('app-access-profile-list') as HTMLElement;
    expect(error?.textContent).toContain('Falló perfiles');
    expect(error?.compareDocumentPosition(catalog) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(catalog.hidden).toBeTrue();

    (error?.querySelector('button') as HTMLButtonElement | null)?.click();
    fixture.detectChanges();

    expect(profileService.listAccessProfiles).toHaveBeenCalledTimes(2);
    expect(userService.listUsers).toHaveBeenCalledTimes(1);
    expect(query('[data-testid="profiles-load-error"]')).toBeNull();
    expect(catalog.hidden).toBeFalse();
    expect(profileListComponent()?.filters.query).toBe('borrador conservado');
  });

  it('keeps existing error toasts while storing per-resource load errors', () => {
    userService.listUsers.and.returnValue(throwError(() => ({
      error: { detail: 'Falló usuarios' }
    })));
    profileService.listAccessProfiles.and.returnValue(throwError(() => ({
      error: { message: 'Falló perfiles' }
    })));

    render();

    expect(userService.listUsers).toHaveBeenCalledTimes(1);
    expect(profileService.listAccessProfiles).toHaveBeenCalledTimes(1);
    expect(branchService.listBranches).toHaveBeenCalledTimes(1);
    expect(component.loadingUsers).toBeFalse();
    expect(component.loadingProfiles).toBeFalse();
    expect(toast.error).toHaveBeenCalledWith('Falló usuarios');
    expect(toast.error).toHaveBeenCalledWith('Falló perfiles');
  });

  it('binds list loading to the user request instead of the pending profile request', () => {
    const pendingUsers = new Subject<UserResponse[]>();
    const pendingProfiles = new Subject<AccessProfileResponse[]>();
    userService.listUsers.and.returnValue(pendingUsers);
    profileService.listAccessProfiles.and.returnValue(pendingProfiles);
    render();

    expect(component.loading).toBeTrue();
    expect(listComponent()?.loading).toBeTrue();

    pendingUsers.next([...users]);
    pendingUsers.complete();
    fixture.detectChanges();
    expect(component.loading).toBeTrue();
    expect(component.loadingUsers).toBeFalse();
    expect(component.loadingProfiles).toBeTrue();
    expect(listComponent()?.loading).toBeFalse();

    pendingProfiles.next(profiles);
    pendingProfiles.complete();
    fixture.detectChanges();
    expect(component.loading).toBeFalse();
    expect(listComponent()?.loading).toBeFalse();
  });

  it('reloads users only from the list and preserves hidden profile catalog state', () => {
    render();
    profileListComponent()?.setQuery('perfil en progreso');
    userService.listUsers.calls.reset();
    profileService.listAccessProfiles.calls.reset();

    listComponent()?.reloadRequested.emit();
    fixture.detectChanges();

    expect(userService.listUsers).toHaveBeenCalledTimes(1);
    expect(profileService.listAccessProfiles).not.toHaveBeenCalled();
    expect(profileListComponent()?.filters.query).toBe('perfil en progreso');
  });

  function render(): void {
    fixture = TestBed.createComponent(UsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function query(selector: string): Element | null {
    return fixture.nativeElement.querySelector(selector);
  }

  function listComponent(): UserAccessListComponent | null {
    return fixture.debugElement.query(By.directive(UserAccessListComponent))?.componentInstance ?? null;
  }

  function panelComponent(): UserAccessPanelComponent | null {
    return fixture.debugElement.query(By.directive(UserAccessPanelComponent))?.componentInstance ?? null;
  }

  function profileListComponent(): AccessProfileListComponent | null {
    return fixture.debugElement.query(By.directive(AccessProfileListComponent))?.componentInstance ?? null;
  }

  function deferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
  } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(promiseResolve => {
      resolve = promiseResolve;
    });
    return { promise, resolve };
  }

  function inheritedColorVariable(name: string): string {
    return getComputedStyle(document.body).getPropertyValue(name).trim()
      || getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function contrastRatio(foreground: string, background: string): number {
    const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
    const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
    return (lighter + 0.05) / (darker + 0.05);
  }

  function relativeLuminance(color: string): number {
    const hex = color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
    const channelRange = color.startsWith('color(srgb') ? 1 : 255;
    const channels = (hex
      ? hex.slice(1).map(value => Number.parseInt(value, 16) / 255)
      : (color.match(/\d+(?:\.\d+)?/g) ?? [])
          .slice(0, 3)
          .map(value => Number(value) / channelRange))
      .map(value => value <= 0.03928
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4));

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function accessDraft(overrides: Partial<UserAccessDraft> = {}): UserAccessDraft {
    return {
      username: 'nuevo.usuario',
      email: 'nuevo@empresa.test',
      password: 'secreto',
      profileId: 'profile-b',
      branchIds: ['branch-b'],
      ...overrides
    };
  }

  function profileDraft(overrides: Partial<AccessProfileDraft> = {}): AccessProfileDraft {
    return {
      name: 'Operaciones',
      description: null,
      permissionCodes: ['sales.access'],
      ...overrides
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

  function profile(id: string, name: string): AccessProfileResponse {
    return {
      id,
      name,
      description: null,
      permissionCodes: ['sales.access'],
      isSystem: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };
  }

  function branch(id: string, name: string): BranchResponse {
    return {
      id,
      name,
      code: null,
      address: null,
      salesCount: 0,
      cashValue: 0,
      createdAt: '2026-01-01T00:00:00Z'
    };
  }
});
