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

  afterEach(() => {
    document.body.classList.remove('theme-light');
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

  it('marks employee names for human-name typography', () => {
    const employeeName = fixture.nativeElement.querySelector(
      '[data-user-id="u1"] .user-list__employee'
    ) as HTMLElement | null;

    expect(employeeName).not.toBeNull();
    expect(employeeName?.textContent).toContain('Ana Pérez');
  });

  it('gives each row, field, and action a contextual accessible name', () => {
    const row = fixture.nativeElement.querySelector('[data-user-id="u1"]') as HTMLElement;
    const rowName = fixture.nativeElement.querySelector('#user-name-u1') as HTMLElement;
    const fieldLabels = Array.from(
      row.querySelectorAll('.user-list__field-label')
    ).map(label => label.textContent?.trim());
    const edit = row.querySelector('.user-list__open') as HTMLButtonElement;
    const deactivate = row.querySelector('.user-list__status-action') as HTMLButtonElement;
    const activate = fixture.nativeElement.querySelector(
      '[data-user-id="u2"] .user-list__status-action'
    ) as HTMLButtonElement;

    expect(row.getAttribute('aria-labelledby')).toBe('user-name-u1');
    expect(rowName.textContent).toContain('ana.admin');
    expect(fieldLabels).toEqual(['Usuario:', 'Perfil:', 'Sucursales:', 'Estado:']);
    expect(edit.getAttribute('aria-label')).toBe('Editar usuario ana.admin');
    expect(deactivate.getAttribute('aria-label')).toBe('Desactivar usuario ana.admin');
    expect(activate.getAttribute('aria-label')).toBe('Activar usuario bruno.caja');
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

    fixture.componentRef.setInput('users', users);
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
    const bubbled = jasmine.createSpy('rowClick');
    component.statusRequested.subscribe(statusRequested);
    component.userSelected.subscribe(userSelected);

    const row = fixture.nativeElement.querySelector('[data-user-id="u1"]') as HTMLElement;
    const statusButton = fixture.nativeElement.querySelector(
      '[data-user-id="u1"] .user-list__status-action'
    ) as HTMLButtonElement;
    row.addEventListener('click', bubbled);
    statusButton.click();

    expect(statusButton.textContent).toContain('Desactivar');
    expect(statusRequested).toHaveBeenCalledOnceWith(users[0]);
    expect(userSelected).not.toHaveBeenCalled();
    expect(bubbled).not.toHaveBeenCalled();
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

  it('caches visible users and uses OnPush change detection', () => {
    const initialResult = component.visibleUsers;

    fixture.detectChanges();

    expect(component.visibleUsers).toBe(initialResult);
    expect((UserAccessListComponent as unknown as {
      ɵcmp: { onPush: boolean };
    }).ɵcmp.onPush).toBeTrue();

    component.setStatus('inactive');

    expect(component.visibleUsers).not.toBe(initialResult);
    expect(component.visibleUsers.map(item => item.id)).toEqual(['u2']);
  });

  it('contains long unbroken email addresses at a 375px viewport', async () => {
    await setViewport(375);
    component.users = [
      user({
        id: 'long-email',
        username: 'mobile.user',
        email: `${'verylongunbrokenlocalpart'.repeat(6)}@empresa.test`,
        employeeName: 'Nombre Humano'
      })
    ];
    fixture.detectChanges();

    const section = fixture.nativeElement.querySelector('.user-list') as HTMLElement;
    const row = fixture.nativeElement.querySelector('.user-list__row') as HTMLElement;
    const email = fixture.nativeElement.querySelector('.user-list__identity a') as HTMLElement;

    expect(fixture.nativeElement.clientWidth).toBe(375);
    expect(section.scrollWidth).toBeLessThanOrEqual(section.clientWidth);
    expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
    expect(email.getBoundingClientRect().right)
      .toBeLessThanOrEqual(row.getBoundingClientRect().right + 0.5);
  });

  it('computes two responsive columns at 768px and one at 375px', async () => {
    await setViewport(768);
    let row = fixture.nativeElement.querySelector('.user-list__row') as HTMLElement;
    expect(fixture.nativeElement.clientWidth).toBe(768);
    expect(columnCount(row)).toBe(2);
    expect(minimumPixelHeight(
      fixture.nativeElement.querySelector('.user-list__open') as HTMLElement
    )).toBeGreaterThanOrEqual(44);

    await setViewport(375);
    row = fixture.nativeElement.querySelector('.user-list__row') as HTMLElement;
    expect(columnCount(row)).toBe(1);
    expect(fixture.nativeElement.querySelector('.user-list').scrollWidth)
      .toBeLessThanOrEqual(fixture.nativeElement.querySelector('.user-list').clientWidth);
  });

  it('keeps compact labels at WCAG AA contrast in dark and light themes', () => {
    const previousTransition = document.body.style.transition;
    document.body.style.transition = 'none';

    try {
      for (const lightTheme of [false, true]) {
        document.body.classList.toggle('theme-light', lightTheme);

        const background = getComputedStyle(document.body).backgroundColor;
        for (const selector of ['.user-list__eyebrow', '.user-list__head']) {
          const foreground = getComputedStyle(
            fixture.nativeElement.querySelector(selector) as HTMLElement
          ).color;
          expect(contrastRatio(foreground, background))
            .withContext(`${selector} contrast in ${lightTheme ? 'light' : 'dark'} theme`)
            .toBeGreaterThanOrEqual(4.5);
        }
      }
    } finally {
      document.body.style.transition = previousTransition;
    }
  });

  async function setViewport(width: number): Promise<void> {
    fixture.nativeElement.style.width = `${width}px`;
    await nextFrame();
    fixture.detectChanges();
  }

  function nextFrame(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
  }

  function columnCount(element: HTMLElement): number {
    return getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length;
  }

  function minimumPixelHeight(element: HTMLElement): number {
    return Number.parseFloat(getComputedStyle(element).minHeight);
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
