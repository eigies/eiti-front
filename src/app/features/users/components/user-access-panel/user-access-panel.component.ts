import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { ReactiveFormsModule, Validators, FormBuilder } from '@angular/forms';

import { AccessProfileResponse } from '../../../../core/models/access-profile.models';
import { BranchResponse } from '../../../../core/models/branch.models';
import { PermissionCatalog as DefaultPermissionCatalog } from '../../../../core/models/permission.models';
import { UserResponse } from '../../../../core/models/user.models';
import {
  SearchableSelectComponent,
  SearchableSelectOption
} from '../../../../shared/components/searchable-select/searchable-select.component';
import {
  AccessPanelMode,
  buildPermissionModules,
  PermissionModuleView,
  UserAccessDraft
} from '../../users-ui.models';

type PermissionCatalogEntry = Readonly<{
  code: string;
  label: string;
  description: string;
}>;

@Component({
  selector: 'app-user-access-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
  templateUrl: './user-access-panel.component.html',
  styleUrls: ['./user-access-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserAccessPanelComponent implements OnChanges, AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) mode!: Exclude<AccessPanelMode, 'closed'>;
  @Input() user: UserResponse | null = null;
  @Input() profiles: AccessProfileResponse[] = [];
  @Input() branches: BranchResponse[] = [];
  @Input() permissionCatalog: ReadonlyArray<PermissionCatalogEntry> = DefaultPermissionCatalog;
  @Input() saving = false;

  @Output() readonly saveRequested = new EventEmitter<UserAccessDraft>();
  @Output() readonly closeRequested = new EventEmitter<boolean>();

  @ViewChild('panelTitle') private panelTitle?: ElementRef<HTMLElement>;

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    profileId: ['', Validators.required]
  });

  selectedBranchIds = new Set<string>();

  private loadedKey = '';
  private initialBranchSnapshot = '';

  constructor() {
    this.form.valueChanges.subscribe(() => {
      this.form.markAsDirty();
      this.cdr.markForCheck();
    });
  }

  get title(): string {
    return this.mode === 'create' ? 'Crear usuario' : 'Editar acceso';
  }

  get actionLabel(): string {
    if (this.saving) {
      return 'Guardando…';
    }
    return this.mode === 'create' ? 'Crear usuario' : 'Guardar cambios';
  }

  get profileOptions(): SearchableSelectOption[] {
    return this.profiles.map(profile => ({
      value: profile.id,
      label: profile.name,
      searchText: profile.description ?? '',
      meta: profile.description ?? undefined
    }));
  }

  get selectedProfile(): AccessProfileResponse | null {
    const profileId = this.form.controls.profileId.value;
    return this.profiles.find(profile => profile.id === profileId) ?? null;
  }

  get permissionModules(): PermissionModuleView[] {
    return buildPermissionModules(
      this.permissionCatalog,
      this.selectedProfile?.permissionCodes ?? [],
      '',
      true
    );
  }

  get inheritedPermissionCount(): number {
    return this.permissionModules.reduce((count, module) => count + module.permissions.length, 0);
  }

  get allBranchesSelected(): boolean {
    return this.selectedBranchIds.size === 0;
  }

  get branchScopeDirty(): boolean {
    return this.branchSnapshot(this.selectedBranchIds) !== this.initialBranchSnapshot;
  }

  get isDirty(): boolean {
    return this.form.dirty || this.branchScopeDirty;
  }

  ngOnChanges(_: SimpleChanges): void {
    const nextLoadedKey = this.mode === 'edit'
      ? `edit:${this.user?.id ?? 'missing'}`
      : 'create';

    if (nextLoadedKey === this.loadedKey) {
      return;
    }

    this.loadedKey = nextLoadedKey;
    this.loadDraft();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.panelTitle?.nativeElement.focus());
  }

  toggleBranch(branchId: string): void {
    const next = new Set(this.selectedBranchIds);
    if (next.has(branchId)) {
      next.delete(branchId);
    } else {
      next.add(branchId);
    }
    this.selectedBranchIds = next;
  }

  selectAllBranches(): void {
    this.selectedBranchIds = new Set<string>();
  }

  isBranchSelected(branchId: string): boolean {
    return this.selectedBranchIds.has(branchId);
  }

  submit(): void {
    if (this.mode === 'create') {
      this.form.controls.username.setValue(this.form.controls.username.value.trim());
      this.form.controls.email.setValue(this.form.controls.email.value.trim());
    }
    this.form.controls.profileId.setValue(this.form.controls.profileId.value.trim());

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.saveRequested.emit({
      username: (this.mode === 'edit' ? this.user?.username ?? '' : raw.username).trim(),
      email: (this.mode === 'edit' ? this.user?.email ?? '' : raw.email).trim(),
      password: this.mode === 'edit' ? '' : raw.password,
      profileId: raw.profileId.trim(),
      branchIds: this.normalizedBranchIds()
    });
  }

  requestClose(): void {
    this.closeRequested.emit(this.isDirty);
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.requestClose();
  }

  trackByBranchId(_: number, branch: BranchResponse): string {
    return branch.id;
  }

  trackByModuleLabel(_: number, module: PermissionModuleView): string {
    return module.label;
  }

  private loadDraft(): void {
    const editing = this.mode === 'edit';
    this.form.controls.username.enable({ emitEvent: false });
    this.form.controls.email.enable({ emitEvent: false });
    this.form.controls.password.enable({ emitEvent: false });

    this.form.reset({
      username: editing ? this.user?.username ?? '' : '',
      email: editing ? this.user?.email ?? '' : '',
      password: '',
      profileId: editing ? this.user?.profileId ?? '' : ''
    }, { emitEvent: false });

    if (editing) {
      this.form.controls.username.disable({ emitEvent: false });
      this.form.controls.email.disable({ emitEvent: false });
      this.form.controls.password.disable({ emitEvent: false });
    }

    this.selectedBranchIds = new Set(editing ? this.user?.branchIds ?? [] : []);
    this.initialBranchSnapshot = this.branchSnapshot(this.selectedBranchIds);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private normalizedBranchIds(): string[] {
    const knownIds = this.branches
      .filter(branch => this.selectedBranchIds.has(branch.id))
      .map(branch => branch.id);
    const knownIdSet = new Set(knownIds);
    const unknownIds = [...this.selectedBranchIds]
      .filter(branchId => !knownIdSet.has(branchId))
      .sort();

    return [...knownIds, ...unknownIds];
  }

  private branchSnapshot(branchIds: ReadonlySet<string>): string {
    return [...branchIds].sort().join('|');
  }
}
