import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AccessProfileResponse } from '../../../../core/models/access-profile.models';
import { BranchResponse } from '../../../../core/models/branch.models';
import { UserResponse } from '../../../../core/models/user.models';
import {
  SearchableSelectComponent,
  SearchableSelectOption
} from '../../../../shared/components/searchable-select/searchable-select.component';
import {
  EMPTY_USER_FILTERS,
  filterAccessUsers,
  UserAccessFilters
} from '../../users-ui.models';

@Component({
  selector: 'app-user-access-list',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent],
  templateUrl: './user-access-list.component.html',
  styleUrls: ['./user-access-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserAccessListComponent {
  private _users: UserResponse[] = [];

  readonly statusFilterOptions: SearchableSelectOption[] = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' }
  ];

  @Input()
  set users(users: UserResponse[]) {
    this._users = users;
    this.refreshVisibleUsers();
  }

  get users(): UserResponse[] {
    return this._users;
  }

  @Input() profiles: AccessProfileResponse[] = [];
  @Input() branches: BranchResponse[] = [];
  @Input() loading = false;
  @Input() selectedUserId: string | null = null;

  @Output() readonly userSelected = new EventEmitter<UserResponse>();
  @Output() readonly createRequested = new EventEmitter<void>();
  @Output() readonly statusRequested = new EventEmitter<UserResponse>();
  @Output() readonly reloadRequested = new EventEmitter<void>();

  filters: UserAccessFilters = { ...EMPTY_USER_FILTERS };
  visibleUsers: UserResponse[] = [];

  get profileFilterOptions(): SearchableSelectOption[] {
    return [
      { value: '', label: 'Todos' },
      ...this.profiles.map(profile => ({
        value: profile.id,
        label: profile.name
      }))
    ];
  }

  get branchFilterOptions(): SearchableSelectOption[] {
    return [
      { value: '', label: 'Todas' },
      ...this.branches.map(branch => ({
        value: branch.id,
        label: branch.name
      }))
    ];
  }

  get hasActiveFilters(): boolean {
    return this.filters.query.trim().length > 0
      || this.filters.status !== 'all'
      || this.filters.profileId.length > 0
      || this.filters.branchId.length > 0;
  }

  updateFilters(filters: Partial<UserAccessFilters>): void {
    this.filters = { ...this.filters, ...filters };
    this.refreshVisibleUsers();
  }

  setQuery(query: string): void {
    this.updateFilters({ query });
  }

  setStatus(status: UserAccessFilters['status']): void {
    this.updateFilters({ status });
  }

  setProfile(profileId: string): void {
    this.updateFilters({ profileId });
  }

  setBranch(branchId: string): void {
    this.updateFilters({ branchId });
  }

  clearFilters(): void {
    this.filters = { ...EMPTY_USER_FILTERS };
    this.refreshVisibleUsers();
  }

  branchSummary(user: UserResponse): string {
    if (!user.branchIds.length) {
      return 'Todas';
    }

    if (user.branchIds.length === 1) {
      return this.branches.find(branch => branch.id === user.branchIds[0])?.name ?? '1 sucursal';
    }

    return `${user.branchIds.length} sucursales`;
  }

  selectUser(event: Event, user: UserResponse): void {
    event.stopPropagation();
    this.userSelected.emit(user);
  }

  requestStatus(event: Event, user: UserResponse): void {
    event.stopPropagation();
    this.statusRequested.emit(user);
  }

  trackByUserId(_: number, user: UserResponse): string {
    return user.id;
  }

  private refreshVisibleUsers(): void {
    this.visibleUsers = filterAccessUsers(this._users, this.filters);
  }
}
