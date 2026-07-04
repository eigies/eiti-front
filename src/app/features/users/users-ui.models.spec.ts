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
      email: 'testa@example.com',
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
      email: 'testb@example.com',
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
      name: 'Operador',
      description: 'Opera la caja',
      permissionCodes: ['cash.access'],
      isSystem: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    }
  ];

  it('combines query, active status, profile and branch filters without mutating users', () => {
    const snapshot = JSON.stringify(users);

    const result = filterAccessUsers(users, {
      query: 'TeStA',
      status: 'active',
      profileId: 'p1',
      branchId: 'b1'
    });

    expect(result.map(user => user.id)).toEqual(['u1']);
    expect(JSON.stringify(users)).toBe(snapshot);
  });

  it('searches username, email and employee name case-insensitively', () => {
    expect(filterAccessUsers(users, { ...EMPTY_USER_FILTERS, query: 'ANA TESTER' }).map(user => user.id))
      .toEqual(['u1']);
    expect(filterAccessUsers(users, { ...EMPTY_USER_FILTERS, query: 'TESTB@EXAMPLE.COM' }).map(user => user.id))
      .toEqual(['u2']);
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

  it('filters profiles by unused usage and description', () => {
    const profilesWithUnused = [
      ...profiles,
      { ...profiles[1], id: 'p3', name: 'Consulta', description: 'Solo lectura' }
    ];

    expect(filterAccessProfiles(profilesWithUnused, users, {
      ...EMPTY_PROFILE_FILTERS,
      query: 'LECTURA',
      usage: 'unused'
    }).map(profile => profile.id)).toEqual(['p3']);
  });

  it('builds friendly permission modules and marks selected permissions', () => {
    const permissions = [
      { code: 'sales.access', label: 'Ventas: acceso', description: 'Permite ingresar a ventas.' }
    ];
    const snapshot = JSON.stringify(permissions);

    const result = buildPermissionModules(permissions, ['sales.access']);

    expect(result).toEqual([{
      label: 'Ventas',
      total: 1,
      selected: 1,
      codes: ['sales.access'],
      permissions: [{
        code: 'sales.access',
        action: 'acceso',
        description: 'Permite ingresar a ventas.',
        selected: true
      }]
    }]);
    expect(JSON.stringify(permissions)).toBe(snapshot);
  });

  it('filters permission labels and descriptions and supports selected-only view', () => {
    const permissions = [
      { code: 'cash.open', label: 'Caja: abrir', description: 'Inicia el turno.' },
      { code: 'cash.close', label: 'Caja: cerrar', description: 'Finaliza el turno.' },
      { code: 'internal.audit', label: 'Auditoría', description: 'Revisa operaciones.' }
    ];

    expect(buildPermissionModules(permissions, ['cash.close'], 'FINALIZA', true))
      .toEqual([{
        label: 'Caja',
        total: 1,
        selected: 1,
        codes: ['cash.close'],
        permissions: [{
          code: 'cash.close',
          action: 'cerrar',
          description: 'Finaliza el turno.',
          selected: true
        }]
      }]);
    expect(buildPermissionModules(permissions, [], 'auditoría')[0].permissions[0].action)
      .toBe('Auditoría');
  });
});
