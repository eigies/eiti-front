import { AccessProfileResponse } from '../../core/models/access-profile.models';
import { UserResponse } from '../../core/models/user.models';
import {
  EMPTY_PROFILE_FILTERS,
  EMPTY_USER_FILTERS,
  buildPermissionModules,
  filterAccessProfiles,
  filterAccessUsers,
  profileUsageCount
} from './users-ui.models';

describe('users UI models', () => {
  const users: UserResponse[] = [
    {
      id: 'u1',
      username: 'testa',
      firstName: 'Ana',
      lastName: 'Tester',
      fullName: 'Ana Tester',
      email: 'alpha@example.com',
      isActive: true,
      employeeName: 'Ana Tester',
      profileId: 'p1',
      profileName: 'Administrador',
      permissions: [],
      branchIds: ['b1'],
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'u2',
      username: 'testb',
      firstName: 'Beto',
      lastName: 'Tester',
      fullName: 'Beto Tester',
      email: 'cashier@example.com',
      isActive: false,
      employeeName: 'Beto Tester',
      profileId: 'p2',
      profileName: 'Caja',
      permissions: [],
      branchIds: ['b2'],
      createdAt: '2026-01-01T00:00:00Z'
    }
  ];

  const profiles: AccessProfileResponse[] = [
    {
      id: 'p1',
      name: 'Administrador',
      description: 'Acceso completo',
      permissionCodes: ['users.manage'],
      isSystem: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'p2',
      name: 'Caja Operativa',
      description: 'Opera la caja',
      permissionCodes: ['cash.access'],
      isSystem: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'p3',
      name: 'Caja Consulta',
      description: 'Solo lectura',
      permissionCodes: ['cash.access'],
      isSystem: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    }
  ];

  it('combines query, active status, profile and branch filters without mutating users', () => {
    const combinedUsers = [
      users[0],
      { ...users[0], id: 'wrong-status', isActive: false },
      { ...users[0], id: 'wrong-profile', profileId: 'p2' },
      { ...users[0], id: 'wrong-branch', branchIds: ['b2'] },
      { ...users[0], id: 'wrong-query', username: 'other', email: 'other@example.com', employeeName: 'Other' }
    ];
    const snapshot = JSON.stringify(combinedUsers);

    const result = filterAccessUsers(combinedUsers, {
      query: 'TeStA',
      status: 'active',
      profileId: 'p1',
      branchId: 'b1'
    });

    expect(result.map(user => user.id)).toEqual(['u1']);
    expect(JSON.stringify(combinedUsers)).toBe(snapshot);
  });

  it('applies status, profile and branch filters independently', () => {
    expect(filterAccessUsers(users, { ...EMPTY_USER_FILTERS, status: 'active' }).map(user => user.id))
      .toEqual(['u1']);
    expect(filterAccessUsers(users, { ...EMPTY_USER_FILTERS, status: 'inactive' }).map(user => user.id))
      .toEqual(['u2']);
    expect(filterAccessUsers(users, { ...EMPTY_USER_FILTERS, profileId: 'p1' }).map(user => user.id))
      .toEqual(['u1']);
    expect(filterAccessUsers(users, { ...EMPTY_USER_FILTERS, branchId: 'b2' }).map(user => user.id))
      .toEqual(['u2']);
  });

  it('searches username, email and employee name independently and case-insensitively', () => {
    expect(filterAccessUsers(users, { ...EMPTY_USER_FILTERS, query: 'TESTA' }).map(user => user.id))
      .toEqual(['u1']);
    expect(filterAccessUsers(users, { ...EMPTY_USER_FILTERS, query: 'CASHIER@EXAMPLE.COM' }).map(user => user.id))
      .toEqual(['u2']);
    expect(filterAccessUsers(users, { ...EMPTY_USER_FILTERS, query: 'ANA TESTER' }).map(user => user.id))
      .toEqual(['u1']);
  });

  it('combines profile query, custom type and used filters without mutation', () => {
    const profilesSnapshot = JSON.stringify(profiles);
    const usersSnapshot = JSON.stringify(users);

    const result = filterAccessProfiles(profiles, users, {
      query: 'CAJA',
      type: 'custom',
      usage: 'used'
    });

    expect(result.map(profile => profile.id)).toEqual(['p2']);
    expect(profileUsageCount('p1', users)).toBe(1);
    expect(JSON.stringify(profiles)).toBe(profilesSnapshot);
    expect(JSON.stringify(users)).toBe(usersSnapshot);
  });

  it('applies profile type and usage filters independently', () => {
    expect(filterAccessProfiles(profiles, users, {
      ...EMPTY_PROFILE_FILTERS,
      type: 'system'
    }).map(profile => profile.id)).toEqual(['p1']);
    expect(filterAccessProfiles(profiles, users, {
      ...EMPTY_PROFILE_FILTERS,
      type: 'custom'
    }).map(profile => profile.id)).toEqual(['p2', 'p3']);
    expect(filterAccessProfiles(profiles, users, {
      ...EMPTY_PROFILE_FILTERS,
      usage: 'used'
    }).map(profile => profile.id)).toEqual(['p1', 'p2']);
    expect(filterAccessProfiles(profiles, users, {
      ...EMPTY_PROFILE_FILTERS,
      usage: 'unused'
    }).map(profile => profile.id)).toEqual(['p3']);
  });

  it('searches profile names and descriptions independently', () => {
    expect(filterAccessProfiles(profiles, users, {
      ...EMPTY_PROFILE_FILTERS,
      query: 'ADMINISTRADOR'
    }).map(profile => profile.id)).toEqual(['p1']);
    expect(filterAccessProfiles(profiles, users, {
      ...EMPTY_PROFILE_FILTERS,
      query: 'LECTURA'
    }).map(profile => profile.id)).toEqual(['p3']);
  });

  it('builds friendly multi-permission modules with accurate counts', () => {
    const permissions = [
      { code: 'sales.access', label: 'Ventas: acceso', description: 'Permite ingresar a ventas.' },
      { code: 'sales.create', label: 'Ventas: crear', description: 'Permite crear ventas.' },
      { code: 'cash.open', label: 'Caja: abrir', description: 'Permite abrir la caja.' }
    ];
    const snapshot = JSON.stringify(permissions);

    const result = buildPermissionModules(permissions, ['sales.access', 'cash.open']);

    expect(result[0]).toEqual({
      label: 'Ventas',
      total: 2,
      selected: 1,
      codes: ['sales.access', 'sales.create'],
      permissions: [
        {
          code: 'sales.access',
          action: 'acceso',
          description: 'Permite ingresar a ventas.',
          selected: true
        },
        {
          code: 'sales.create',
          action: 'crear',
          description: 'Permite crear ventas.',
          selected: false
        }
      ]
    });
    expect(result[1].label).toBe('Caja');
    expect(result[1].total).toBe(1);
    expect(result[1].selected).toBe(1);
    expect(JSON.stringify(permissions)).toBe(snapshot);
  });

  it('filters permission labels and descriptions independently', () => {
    const permissions = [
      { code: 'cash.open', label: 'Caja: abrir', description: 'Inicia el turno.' },
      { code: 'cash.close', label: 'Caja: cerrar', description: 'Finaliza el turno.' },
      { code: 'internal.audit', label: 'Auditoría', description: 'Revisa operaciones.' }
    ];

    expect(buildPermissionModules(permissions, [], 'ABRIR')[0].codes).toEqual(['cash.open']);
    expect(buildPermissionModules(permissions, [], 'FINALIZA')[0].codes).toEqual(['cash.close']);
    expect(buildPermissionModules(permissions, [], 'auditoría')[0].permissions[0].action)
      .toBe('Auditoría');
  });

  it('applies selected-only independently from search', () => {
    const permissions = [
      { code: 'cash.open', label: 'Caja: abrir', description: 'Inicia el turno.' },
      { code: 'cash.close', label: 'Caja: cerrar', description: 'Finaliza el turno.' }
    ];

    expect(buildPermissionModules(permissions, ['cash.close'], 'CAJA', true)[0].codes)
      .toEqual(['cash.close']);
    expect(buildPermissionModules(permissions, ['cash.close'], 'CAJA', false)[0].codes)
      .toEqual(['cash.open', 'cash.close']);
  });

  it('exposes frozen empty filter constants', () => {
    expect(Object.isFrozen(EMPTY_USER_FILTERS)).toBeTrue();
    expect(Object.isFrozen(EMPTY_PROFILE_FILTERS)).toBeTrue();
  });

  it('uses friendly nonblank fallbacks for empty and malformed permission labels', () => {
    const permissions = [
      { code: 'empty.code', label: '', description: 'Etiqueta vacía.' },
      { code: 'missing.module', label: ': administrar', description: 'Sin módulo.' },
      { code: 'missing.action', label: 'Caja: ', description: 'Sin acción.' }
    ];

    const result = buildPermissionModules(permissions, []);

    expect(result.map(module => module.label)).toEqual(['General', 'Caja']);
    expect(result[0].permissions.map(permission => permission.action))
      .toEqual(['Permiso', 'administrar']);
    expect(result[1].permissions[0].action).toBe('Caja');
    expect(result.flatMap(module => module.permissions).every(permission => permission.action.trim().length > 0))
      .toBeTrue();
  });
});
