import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccessProfileResponse } from '../../../../core/models/access-profile.models';
import { UserResponse } from '../../../../core/models/user.models';
import {
  SearchableSelectComponent,
  SearchableSelectOption
} from '../../../../shared/components/searchable-select/searchable-select.component';
import {
  AccessProfileFilters,
  EMPTY_PROFILE_FILTERS,
  filterAccessProfiles,
  profileUsageCount
} from '../../users-ui.models';

@Component({
  selector: 'app-access-profile-list',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent],
  templateUrl: './access-profile-list.component.html',
  styleUrls: ['./access-profile-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccessProfileListComponent {
  private _profiles: AccessProfileResponse[] = [];
  private _users: UserResponse[] = [];

  readonly typeFilterOptions: SearchableSelectOption[] = [
    { value: 'all', label: 'Todos' },
    { value: 'system', label: 'Sistema' },
    { value: 'custom', label: 'Personalizados' }
  ];

  readonly usageFilterOptions: SearchableSelectOption[] = [
    { value: 'all', label: 'Todos' },
    { value: 'used', label: 'Asignados' },
    { value: 'unused', label: 'Sin usuarios' }
  ];

  @Input()
  set profiles(profiles: AccessProfileResponse[]) {
    this._profiles = profiles;
    this.refreshVisibleProfiles();
  }

  get profiles(): AccessProfileResponse[] {
    return this._profiles;
  }

  @Input()
  set users(users: UserResponse[]) {
    this._users = users;
    this.refreshVisibleProfiles();
  }

  get users(): UserResponse[] {
    return this._users;
  }

  @Input() loading = false;
  @Input() selectedProfileId: string | null = null;

  @Output() readonly profileSelected = new EventEmitter<AccessProfileResponse>();
  @Output() readonly createRequested = new EventEmitter<void>();
  @Output() readonly deleteRequested = new EventEmitter<AccessProfileResponse>();
  @Output() readonly reloadRequested = new EventEmitter<void>();

  filters: AccessProfileFilters = { ...EMPTY_PROFILE_FILTERS };
  visibleProfiles: AccessProfileResponse[] = [];

  constructor(private readonly cdr: ChangeDetectorRef) {}

  get hasActiveFilters(): boolean {
    return this.filters.query.trim().length > 0
      || this.filters.type !== 'all'
      || this.filters.usage !== 'all';
  }

  updateFilters(filters: Partial<AccessProfileFilters>): void {
    this.filters = { ...this.filters, ...filters };
    this.refreshVisibleProfiles();
  }

  setQuery(query: string): void {
    this.updateFilters({ query });
  }

  setType(type: AccessProfileFilters['type']): void {
    this.updateFilters({ type });
  }

  setUsage(usage: AccessProfileFilters['usage']): void {
    this.updateFilters({ usage });
  }

  clearFilters(): void {
    this.filters = { ...EMPTY_PROFILE_FILTERS };
    this.refreshVisibleProfiles();
  }

  usage(profileId: string): number {
    return profileUsageCount(profileId, this._users);
  }

  selectProfile(event: Event, profile: AccessProfileResponse): void {
    event.stopPropagation();
    this.profileSelected.emit(profile);
  }

  requestDelete(event: Event, profile: AccessProfileResponse): void {
    event.stopPropagation();
    this.deleteRequested.emit(profile);
  }

  trackByProfileId(_: number, profile: AccessProfileResponse): string {
    return profile.id;
  }

  private refreshVisibleProfiles(): void {
    this.visibleProfiles = filterAccessProfiles(this._profiles, this._users, this.filters);
    this.cdr.markForCheck();
  }
}
