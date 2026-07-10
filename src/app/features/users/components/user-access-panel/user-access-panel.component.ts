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
  OnDestroy,
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
export class UserAccessPanelComponent implements OnChanges, AfterViewInit, OnDestroy {
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

  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;
  @ViewChild('panelTitle') private panelTitle?: ElementRef<HTMLElement>;
  @ViewChild(SearchableSelectComponent)
  private profileSelect?: SearchableSelectComponent;

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    firstName: ['', [Validators.required, Validators.maxLength(80)]],
    lastName: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    profileId: ['', Validators.required],
    isEmployee: [false]
  });

  selectedBranchIds = new Set<string>();

  private loadedKey = '';
  private initialBranchSnapshot = '';
  private previouslyFocusedElement: HTMLElement | null = null;
  private inertSiblings: Array<{ element: HTMLElement; wasInert: boolean }> = [];

  constructor() {
    this.form.valueChanges.subscribe(() => this.cdr.markForCheck());
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

  ngOnChanges(changes: SimpleChanges): void {
    const nextLoadedKey = this.mode === 'edit'
      ? `edit:${this.user?.id ?? 'missing'}`
      : 'create';

    if (
      nextLoadedKey !== this.loadedKey
      || (changes['user'] && !this.isDirty)
    ) {
      this.loadedKey = nextLoadedKey;
      this.loadDraft();
    } else if (changes['saving']) {
      this.syncSavingState();
    }
  }

  ngAfterViewInit(): void {
    this.previouslyFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    this.makeBackgroundInert();
    setTimeout(() => this.panelTitle?.nativeElement.focus());
  }

  ngOnDestroy(): void {
    this.restoreBackground();
    if (this.previouslyFocusedElement?.isConnected) {
      this.previouslyFocusedElement.focus();
    }
  }

  toggleBranch(branchId: string): void {
    if (this.saving) {
      return;
    }

    const next = new Set(this.selectedBranchIds);
    if (next.has(branchId)) {
      next.delete(branchId);
    } else {
      next.add(branchId);
    }
    this.selectedBranchIds = next;
    this.cdr.markForCheck();
  }

  selectAllBranches(): void {
    if (this.saving) {
      return;
    }
    this.selectedBranchIds = new Set<string>();
    this.cdr.markForCheck();
  }

  isBranchSelected(branchId: string): boolean {
    return this.selectedBranchIds.has(branchId);
  }

  submit(): void {
    if (this.saving) {
      return;
    }

    if (this.mode === 'create') {
      this.form.controls.username.setValue(
        this.form.controls.username.value.trim(),
        { emitEvent: false }
      );
      this.form.controls.email.setValue(
        this.form.controls.email.value.trim(),
        { emitEvent: false }
      );
    }
    this.form.controls.profileId.setValue(
      this.form.controls.profileId.value.trim(),
      { emitEvent: false }
    );

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.saveRequested.emit({
      username: (this.mode === 'edit' ? this.user?.username ?? '' : raw.username).trim(),
      firstName: raw.firstName.trim(),
      lastName: raw.lastName.trim(),
      email: (this.mode === 'edit' ? this.user?.email ?? '' : raw.email).trim(),
      password: this.mode === 'edit' ? '' : raw.password,
      profileId: raw.profileId.trim(),
      isEmployee: raw.isEmployee,
      branchIds: this.normalizedBranchIds()
    });
  }

  requestClose(): void {
    if (this.saving) {
      return;
    }
    this.closeRequested.emit(this.isDirty);
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (this.saving || this.profileSelect?.open) {
      return;
    }
    this.requestClose();
  }

  @HostListener('document:keydown', ['$event'])
  handleTab(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }

    const panel = this.panel?.nativeElement;
    if (!panel) {
      return;
    }

    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), '
      + 'select:not([disabled]), textarea:not([disabled]), '
      + '[tabindex]:not([tabindex="-1"])'
    )).filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true');

    if (!focusable.length) {
      event.preventDefault();
      this.panelTitle?.nativeElement.focus();
      return;
    }

    const active = document.activeElement;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (active === first || !panel.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
      event.preventDefault();
      first.focus();
    }
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
      firstName: editing ? this.user?.firstName ?? '' : '',
      lastName: editing ? this.user?.lastName ?? '' : '',
      email: editing ? this.user?.email ?? '' : '',
      password: '',
      profileId: editing ? this.user?.profileId ?? '' : '',
      isEmployee: editing ? !!this.user?.employeeId : false
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
    this.syncSavingState();
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

  private syncSavingState(): void {
    if (this.saving) {
      this.form.disable({ emitEvent: false });
      return;
    }

    this.form.enable({ emitEvent: false });
    if (this.mode === 'edit') {
      this.form.controls.username.disable({ emitEvent: false });
      this.form.controls.email.disable({ emitEvent: false });
      this.form.controls.password.disable({ emitEvent: false });
    }
  }

  private makeBackgroundInert(): void {
    let overlayPathElement: HTMLElement | null =
      this.panel?.nativeElement.parentElement ?? null;
    if (!overlayPathElement) {
      return;
    }

    this.inertSiblings = [];
    while (true) {
      const parentElement: HTMLElement | null = overlayPathElement.parentElement;
      if (!parentElement) {
        break;
      }

      const siblings = Array.from(parentElement.children)
        .filter((element): element is HTMLElement =>
          element instanceof HTMLElement && element !== overlayPathElement
        );
      for (const element of siblings) {
        this.inertSiblings.push({ element, wasInert: element.inert });
        element.inert = true;
      }

      if (parentElement === document.body) {
        break;
      }
      overlayPathElement = parentElement;
    }
  }

  private restoreBackground(): void {
    for (const { element, wasInert } of [...this.inertSiblings].reverse()) {
      element.inert = wasInert;
    }
    this.inertSiblings = [];
  }
}
