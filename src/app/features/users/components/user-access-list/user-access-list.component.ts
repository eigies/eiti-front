import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AccessProfileResponse } from '../../../../core/models/access-profile.models';
import { BranchResponse } from '../../../../core/models/branch.models';
import { UserResponse } from '../../../../core/models/user.models';
import {
  EMPTY_USER_FILTERS,
  filterAccessUsers,
  UserAccessFilters
} from '../../users-ui.models';

@Component({
  selector: 'app-user-access-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-access-list.component.html',
  styleUrls: ['./user-access-list.component.css']
})
export class UserAccessListComponent {
  @Input() users: UserResponse[] = [];
  @Input() profiles: AccessProfileResponse[] = [];
  @Input() branches: BranchResponse[] = [];
  @Input() loading = false;
  @Input() selectedUserId: string | null = null;

  @Output() readonly userSelected = new EventEmitter<UserResponse>();
  @Output() readonly createRequested = new EventEmitter<void>();
  @Output() readonly statusRequested = new EventEmitter<UserResponse>();
  @Output() readonly reloadRequested = new EventEmitter<void>();

  filters: UserAccessFilters = { ...EMPTY_USER_FILTERS };

  get visibleUsers(): UserResponse[] {
    return filterAccessUsers(this.users, this.filters);
  }

  get hasActiveFilters(): boolean {
    return this.filters.query.trim().length > 0
      || this.filters.status !== 'all'
      || this.filters.profileId.length > 0
      || this.filters.branchId.length > 0;
  }

  updateFilters(filters: Partial<UserAccessFilters>): void {
    this.filters = { ...this.filters, ...filters };
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
}
