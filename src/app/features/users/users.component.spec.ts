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
import { UserAccessDraft } from './users-ui.models';
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

  afterEach(() => fixture?.destroy());

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

  it('confirms deactivation but activates directly and calls setStatus with exact values', fakeAsync(() => {
    const active = user({ id: 'active', username: 'activo', isActive: true });
    const inactive = user({ id: 'inactive', username: 'inactivo', isActive: false });
    userService.setStatus.and.callFake((id, isActive) =>
      of(user({ id, username: id, isActive }))
    );
    render();

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
    expect(profilesSection.querySelector('.panel--profiles-editor')).not.toBeNull();

    tabs[1].click();
    fixture.detectChanges();

    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(usersSection.hidden).toBeTrue();
    expect(profilesSection.hidden).toBeFalse();
    expect(listComponent()).not.toBeNull();
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
    const componentStyles = Array.from(document.head.querySelectorAll('style'))
      .map(style => style.textContent ?? '')
      .find(css => css.includes('.access-tabs__item'));

    expect(Number.parseFloat(getComputedStyle(tab).minHeight)).toBeGreaterThanOrEqual(44);
    expect(componentStyles).toMatch(/\.access-tabs__item[^{]*:focus-visible[\s\S]*outline:/);

    fixture.nativeElement.style.width = '375px';
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    fixture.detectChanges();
    const page = query('.page') as HTMLElement;
    expect(page.scrollWidth).toBeLessThanOrEqual(page.clientWidth);
  });

  it('preserves data-loading behavior and reports user and profile load errors', () => {
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

  it('keeps loading true until pending user and profile requests settle', () => {
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

    pendingProfiles.next(profiles);
    pendingProfiles.complete();
    fixture.detectChanges();
    expect(component.loading).toBeFalse();
    expect(listComponent()?.loading).toBeFalse();
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
