import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccessProfileResponse } from '../../../../core/models/access-profile.models';
import { BranchResponse } from '../../../../core/models/branch.models';
import { UserResponse } from '../../../../core/models/user.models';
import { UserAccessListComponent } from './user-access-list.component';

describe('UserAccessListComponent', () => {
  let fixture: ComponentFixture<UserAccessListComponent>;
  let component: UserAccessListComponent;

  const profiles: AccessProfileResponse[] = [
    profile('p1', 'Administración'),
    profile('p2', 'Caja')
  ];
  const branches: BranchResponse[] = [
    branch('b1', 'Centro'),
    branch('b2', 'Norte'),
    branch('b3', 'Sur')
  ];
  const users: UserResponse[] = [
    user({
      id: 'u1',
      username: 'ana.admin',
      email: 'ana@empresa.test',
      employeeName: 'Ana Pérez',
      profileId: 'p1',
      profileName: 'Administración',
      branchIds: [],
      isActive: true
    }),
    user({
      id: 'u2',
      username: 'bruno.caja',
      email: 'caja.norte@empresa.test',
      employeeName: 'Bruno Díaz',
      profileId: 'p2',
      profileName: 'Caja',
      branchIds: ['b1', 'b2'],
      isActive: false
    }),
    user({
      id: 'u3',
      username: 'carla.caja',
      email: 'carla@empresa.test',
      employeeName: 'Carla Sur',
      profileId: 'p2',
      profileName: 'Caja',
      branchIds: ['b3'],
      isActive: true
    })
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserAccessListComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(UserAccessListComponent);
    component = fixture.componentInstance;
    component.users = users;
    component.profiles = profiles;
    component.branches = branches;
    fixture.detectChanges();
  });

  it('renders users as the primary content and emits the exact user from its edit control', () => {
    const selected = jasmine.createSpy('userSelected');
    component.userSelected.subscribe(selected);

    const rows = fixture.nativeElement.querySelectorAll('[data-user-id]');
    const edit = fixture.nativeElement.querySelector('[data-user-id="u1"] .user-list__open') as HTMLButtonElement;

    expect(rows.length).toBe(3);
    expect(edit.textContent).toContain('Editar usuario');

    edit.click();

    expect(selected).toHaveBeenCalledOnceWith(users[0]);
  });

  it('filters inactive users independently without mutating the users input', () => {
    const originalUsers = component.users;
    const originalSnapshot = component.users.map(item => ({ ...item, branchIds: [...item.branchIds] }));

    component.setStatus('inactive');

    expect(component.visibleUsers.map(item => item.id)).toEqual(['u2']);
    expect(component.users).toBe(originalUsers);
    expect(component.users).toEqual(originalSnapshot);
  });

  it('matches query by employee and email', () => {
    component.setQuery('Ana Pérez');
    expect(component.visibleUsers.map(item => item.id)).toEqual(['u1']);

    component.setQuery('caja.norte@empresa.test');
    expect(component.visibleUsers.map(item => item.id)).toEqual(['u2']);
  });

  it('discriminates profile and branch filters', () => {
    component.setProfile('p1');
    expect(component.visibleUsers.map(item => item.id)).toEqual(['u1']);

    component.clearFilters();
    component.setBranch('b3');
    expect(component.visibleUsers.map(item => item.id)).toEqual(['u3']);
  });

  it('summarizes all, one, and many branch assignments', () => {
    expect(component.branchSummary(users[0])).toBe('Todas');
    expect(component.branchSummary(users[2])).toBe('Sur');
    expect(component.branchSummary(users[1])).toBe('2 sucursales');
  });

  it('distinguishes an empty catalog from no filtered results', () => {
    component.users = [];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.user-list__empty--catalog')?.textContent)
      .toContain('Todavía no hay usuarios');

    component.users = users;
    component.setQuery('nadie');
    fixture.detectChanges();
    const noResults = fixture.nativeElement.querySelector('.user-list__empty--filtered');
    expect(noResults?.textContent).toContain('No encontramos usuarios');
    expect(noResults?.querySelector('.user-list__clear')).not.toBeNull();
  });

  it('shows active filters and clears all of them', () => {
    component.updateFilters({
      query: 'ana',
      status: 'active',
      profileId: 'p1',
      branchId: 'b1'
    });
    fixture.detectChanges();

    expect(component.hasActiveFilters).toBeTrue();
    const clear = fixture.nativeElement.querySelector('.user-list__clear') as HTMLButtonElement;
    expect(clear).not.toBeNull();

    clear.click();

    expect(component.hasActiveFilters).toBeFalse();
    expect(component.visibleUsers).toEqual(users);
  });

  it('emits create and reload requests from the toolbar', () => {
    const createRequested = jasmine.createSpy('createRequested');
    const reloadRequested = jasmine.createSpy('reloadRequested');
    component.createRequested.subscribe(createRequested);
    component.reloadRequested.subscribe(reloadRequested);

    fixture.nativeElement.querySelector('.user-list__create').click();
    fixture.nativeElement.querySelector('.user-list__reload').click();

    expect(createRequested).toHaveBeenCalledTimes(1);
    expect(reloadRequested).toHaveBeenCalledTimes(1);
  });

  it('emits a status request without opening the user', () => {
    const statusRequested = jasmine.createSpy('statusRequested');
    const userSelected = jasmine.createSpy('userSelected');
    component.statusRequested.subscribe(statusRequested);
    component.userSelected.subscribe(userSelected);

    const statusButton = fixture.nativeElement.querySelector(
      '[data-user-id="u1"] .user-list__status-action'
    ) as HTMLButtonElement;
    statusButton.click();

    expect(statusButton.textContent).toContain('Desactivar');
    expect(statusRequested).toHaveBeenCalledOnceWith(users[0]);
    expect(userSelected).not.toHaveBeenCalled();
  });

  it('uses stable desktop header and responsive card class structure', () => {
    const list = fixture.nativeElement.querySelector('.user-list__table');
    const head = fixture.nativeElement.querySelector('.user-list__head');
    const row = fixture.nativeElement.querySelector('.user-list__row');

    expect(list).not.toBeNull();
    expect(head.textContent).toContain('Usuario');
    expect(head.textContent).toContain('Perfil');
    expect(head.textContent).toContain('Sucursales');
    expect(head.textContent).toContain('Estado');
    expect(head.textContent).toContain('Acciones');
    expect(row.querySelector('.user-list__identity')).not.toBeNull();
    expect(row.querySelector('.user-list__access')).not.toBeNull();
    expect(row.querySelector('.user-list__actions')).not.toBeNull();
  });

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
      permissions: ['raw.permission.code'],
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
      permissionCodes: [],
      isSystem: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };
  }

  function branch(id: string, name: string): BranchResponse {
    return {
      id,
      name,
      salesCount: 0,
      cashValue: 0,
      createdAt: '2026-01-01T00:00:00Z'
    };
  }
});
