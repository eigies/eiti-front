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
  query: '',
  status: 'all',
  profileId: '',
  branchId: ''
};

export const EMPTY_PROFILE_FILTERS: AccessProfileFilters = {
  query: '',
  type: 'all',
  usage: 'all'
};

export function filterAccessUsers(
  users: readonly UserResponse[],
  filters: UserAccessFilters
): UserResponse[] {
  const query = normalize(filters.query);

  return users.filter(user => {
    const matchesQuery = !query || [user.username, user.email, user.employeeName]
      .some(value => normalize(value).includes(query));
    const matchesStatus = filters.status === 'all'
      || (filters.status === 'active' ? user.isActive : !user.isActive);
    const matchesProfile = !filters.profileId || user.profileId === filters.profileId;
    const matchesBranch = !filters.branchId || user.branchIds.includes(filters.branchId);

    return matchesQuery && matchesStatus && matchesProfile && matchesBranch;
  });
}

export function profileUsageCount(profileId: string, users: readonly UserResponse[]): number {
  return users.filter(user => user.profileId === profileId).length;
}

export function filterAccessProfiles(
  profiles: readonly AccessProfileResponse[],
  users: readonly UserResponse[],
  filters: AccessProfileFilters
): AccessProfileResponse[] {
  const query = normalize(filters.query);

  return profiles.filter(profile => {
    const matchesQuery = !query || [profile.name, profile.description]
      .some(value => normalize(value).includes(query));
    const matchesType = filters.type === 'all'
      || (filters.type === 'system' ? profile.isSystem : !profile.isSystem);
    const isUsed = profileUsageCount(profile.id, users) > 0;
    const matchesUsage = filters.usage === 'all'
      || (filters.usage === 'used' ? isUsed : !isUsed);

    return matchesQuery && matchesType && matchesUsage;
  });
}

export function buildPermissionModules(
  permissions: readonly { code: string; label: string; description: string }[],
  selectedCodes: readonly string[],
  query = '',
  selectedOnly = false
): PermissionModuleView[] {
  const selected = new Set(selectedCodes);
  const normalizedQuery = normalize(query);
  const modules = new Map<string, PermissionModuleView['permissions']>();

  for (const permission of permissions) {
    const isSelected = selected.has(permission.code);
    const matchesQuery = !normalizedQuery
      || normalize(permission.label).includes(normalizedQuery)
      || normalize(permission.description).includes(normalizedQuery);

    if (!matchesQuery || (selectedOnly && !isSelected)) {
      continue;
    }

    const separatorIndex = permission.label.indexOf(':');
    const moduleLabel = separatorIndex >= 0
      ? permission.label.slice(0, separatorIndex).trim()
      : permission.label.trim();
    const action = separatorIndex >= 0
      ? permission.label.slice(separatorIndex + 1).trim()
      : permission.label.trim();
    const modulePermissions = modules.get(moduleLabel) ?? [];

    modulePermissions.push({
      code: permission.code,
      action,
      description: permission.description,
      selected: isSelected
    });
    modules.set(moduleLabel, modulePermissions);
  }

  return Array.from(modules, ([label, modulePermissions]) => ({
    label,
    total: modulePermissions.length,
    selected: modulePermissions.filter(permission => permission.selected).length,
    codes: modulePermissions.map(permission => permission.code),
    permissions: modulePermissions
  }));
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase();
}
