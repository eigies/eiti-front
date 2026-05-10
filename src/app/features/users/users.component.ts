import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccessProfileResponse } from '../../core/models/access-profile.models';
import { PermissionCatalog } from '../../core/models/permission.models';
import { UserResponse } from '../../core/models/user.models';
import { AccessProfileService } from '../../core/services/access-profile.service';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../shared/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SearchableSelectComponent],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersComponent implements OnInit {
  readonly sections = [
    { id: 'admin', label: 'Administrador', eyebrow: 'ABM de usuarios' },
    { id: 'profiles', label: 'Perfiles', eyebrow: 'ABM de perfiles' }
  ] as const;

  readonly createForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    profileId: ['', Validators.required]
  });

  readonly profileForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]]
  });

  readonly permissionCatalog = PermissionCatalog;
  readonly permissionCategories = this.buildPermissionCategories();
  users: UserResponse[] = [];
  profiles: AccessProfileResponse[] = [];
  activeSection: 'admin' | 'profiles' = 'admin';
  activePermissionCategory = 'Todas';
  loadingUsers = true;
  loadingProfiles = true;
  savingCreate = false;
  savingProfile = false;
  editingProfileId: string | null = null;
  selectedProfilePermissionCodes = new Set<string>();
  collapsedUserIds = new Set<string>();
  collapsedProfileIds = new Set<string>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private readonly fb: FormBuilder,
    private readonly userService: UserService,
    private readonly accessProfileService: AccessProfileService,
    private readonly toast: ToastService,
    private readonly auth: AuthService
  ) { }

  ngOnInit(): void {
    this.beginCreateProfile();
    this.loadData();
  }

  get activeUsersCount(): number {
    return this.users.filter(user => user.isActive).length;
  }

  get customProfilesCount(): number {
    return this.profiles.filter(profile => !profile.isSystem).length;
  }

  get loading(): boolean {
    return this.loadingUsers || this.loadingProfiles;
  }

  get selectedCreateProfile(): AccessProfileResponse | undefined {
    return this.profiles.find(profile => profile.id === this.createForm.controls.profileId.value);
  }

  get profileOptions(): SearchableSelectOption[] {
    return this.profiles.map(profile => ({
      value: profile.id,
      label: profile.name,
      meta: profile.description ?? undefined
    }));
  }

  get profileEditorTitle(): string {
    return this.editingProfileId ? 'Editar perfil' : 'Crear perfil';
  }

  get profileEditorActionLabel(): string {
    if (this.savingProfile) {
      return 'Guardando...';
    }

    return this.editingProfileId ? 'Guardar cambios' : 'Crear perfil';
  }

  get selectedProfilePermissionsLabel(): string {
    return this.selectedProfilePermissionCodes.size > 0
      ? `${this.selectedProfilePermissionCodes.size} permisos seleccionados`
      : 'Selecciona al menos un permiso.';
  }

  get filteredPermissionCatalog(): ReadonlyArray<{ code: string; label: string; description: string }> {
    if (this.activePermissionCategory === 'Todas') {
      return this.permissionCatalog;
    }

    return this.permissionCatalog.filter(permission => this.permissionCategoryOf(permission.label) === this.activePermissionCategory);
  }

  loadData(): void {
    this.loadingProfiles = true;
    this.accessProfileService.listAccessProfiles().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: profiles => {
        this.profiles = profiles.sort((left, right) => left.name.localeCompare(right.name));
        this.collapsedProfileIds = new Set(this.profiles.map(profile => profile.id));
        this.loadingProfiles = false;
        this.ensureCreateProfileSelection();
        this.cdr.markForCheck();
      },
      error: err => {
        this.loadingProfiles = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar los perfiles');
        this.cdr.markForCheck();
      }
    });

    this.loadingUsers = true;
    this.userService.listUsers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: users => {
        this.users = users.sort((left, right) => left.username.localeCompare(right.username));
        this.collapsedUserIds = new Set(this.users.map(user => user.id));
        this.loadingUsers = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.loadingUsers = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar los usuarios');
        this.cdr.markForCheck();
      }
    });
  }

  isProfilePermissionSelected(permissionCode: string): boolean {
    return this.selectedProfilePermissionCodes.has(permissionCode);
  }

  toggleProfilePermission(permissionCode: string): void {
    if (this.selectedProfilePermissionCodes.has(permissionCode)) {
      this.selectedProfilePermissionCodes.delete(permissionCode);
      return;
    }

    this.selectedProfilePermissionCodes.add(permissionCode);
  }

  createUser(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      this.toast.error('Completa usuario, email, password y un perfil.');
      return;
    }

    const raw = this.createForm.getRawValue();
    this.savingCreate = true;
    this.userService.createUser({
      username: String(raw.username || '').trim(),
      email: String(raw.email || '').trim(),
      password: String(raw.password || ''),
      profileId: String(raw.profileId || ''),
      employeeId: null
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: user => {
        this.users = [user, ...this.users].sort((left, right) => left.username.localeCompare(right.username));
        this.collapsedUserIds.add(user.id);
        this.createForm.reset({
          username: '',
          email: '',
          password: '',
          profileId: this.selectedCreateProfile?.id ?? this.profiles[0]?.id ?? ''
        });
        this.savingCreate = false;
        this.toast.success('Usuario creado');
        this.cdr.markForCheck();
      },
      error: err => {
        this.savingCreate = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo crear el usuario');
        this.cdr.markForCheck();
      }
    });
  }

  beginCreateProfile(): void {
    this.editingProfileId = null;
    this.selectedProfilePermissionCodes = new Set<string>();
    this.profileForm.reset({ name: '', description: '' });
  }

  beginEditProfile(profile: AccessProfileResponse): void {
    this.editingProfileId = profile.id;
    this.selectedProfilePermissionCodes = new Set<string>(profile.permissionCodes);
    this.profileForm.reset({
      name: profile.name,
      description: profile.description ?? ''
    });
  }

  cancelProfileEditor(): void {
    this.beginCreateProfile();
  }

  saveProfile(): void {
    if (this.profileForm.invalid || this.selectedProfilePermissionCodes.size === 0) {
      this.profileForm.markAllAsTouched();
      this.toast.error('Completa nombre y selecciona al menos un permiso.');
      return;
    }

    const raw = this.profileForm.getRawValue();
    const request = {
      name: String(raw.name || '').trim(),
      description: String(raw.description || '').trim() || null,
      permissionCodes: [...this.selectedProfilePermissionCodes]
    };

    const editingProfileId = this.editingProfileId;
    this.savingProfile = true;
    const action = editingProfileId
      ? this.accessProfileService.updateAccessProfile(editingProfileId, request)
      : this.accessProfileService.createAccessProfile(request);

    action.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: profile => {
        const filtered = this.profiles.filter(item => item.id !== profile.id);
        this.profiles = [...filtered, profile].sort((left, right) => left.name.localeCompare(right.name));
        this.collapsedProfileIds.add(profile.id);
        this.ensureCreateProfileSelection(profile.id);
        this.savingProfile = false;
        this.beginCreateProfile();
        this.toast.success(editingProfileId ? 'Perfil actualizado' : 'Perfil creado');
        this.cdr.markForCheck();
        this.reloadUsers();
        this.auth.refreshCurrentUserProfile();
      },
      error: err => {
        this.savingProfile = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo guardar el perfil');
        this.cdr.markForCheck();
      }
    });
  }

  deleteProfile(profile: AccessProfileResponse): void {
    if (!window.confirm(`Se eliminara el perfil "${profile.name}".`)) {
      return;
    }

    this.accessProfileService.deleteAccessProfile(profile.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.profiles = this.profiles.filter(item => item.id !== profile.id);
        this.collapsedProfileIds.delete(profile.id);
        if (this.editingProfileId === profile.id) {
          this.beginCreateProfile();
        }
        this.ensureCreateProfileSelection();
        this.toast.success('Perfil eliminado');
        this.cdr.markForCheck();
      },
      error: err => {
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo eliminar el perfil');
        this.cdr.markForCheck();
      }
    });
  }

  updateUserProfile(user: UserResponse, profileId: string): void {
    if (!profileId || profileId === user.profileId) {
      return;
    }

    this.userService.updateProfile(user.id, { profileId, employeeId: user.employeeId || null }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.patchUser(updated);
        this.toast.success('Perfil asignado');
        this.auth.refreshCurrentUserProfile();
        this.cdr.markForCheck();
      },
      error: err => {
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo actualizar el perfil');
        this.cdr.markForCheck();
      }
    });
  }

  onProfileSelectChange(user: UserResponse, value: string | number | null): void {
    this.updateUserProfile(user, String(value ?? ''));
  }

  isUserCollapsed(userId: string): boolean {
    return this.collapsedUserIds.has(userId);
  }

  isProfileCollapsed(profileId: string): boolean {
    return this.collapsedProfileIds.has(profileId);
  }

  selectSection(sectionId: 'admin' | 'profiles'): void {
    this.activeSection = sectionId;
  }

  selectPermissionCategory(category: string): void {
    this.activePermissionCategory = category;
  }

  toggleUserCollapse(userId: string): void {
    if (this.collapsedUserIds.has(userId)) {
      this.collapsedUserIds.delete(userId);
      return;
    }

    this.collapsedUserIds.add(userId);
  }

  toggleProfileCollapse(profileId: string): void {
    if (this.collapsedProfileIds.has(profileId)) {
      this.collapsedProfileIds.delete(profileId);
      return;
    }

    this.collapsedProfileIds.add(profileId);
  }

  toggleStatus(user: UserResponse): void {
    this.userService.setStatus(user.id, !user.isActive).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.patchUser(updated);
        this.toast.success(updated.isActive ? 'Usuario activado' : 'Usuario desactivado');
        this.cdr.markForCheck();
      },
      error: err => {
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo actualizar el estado');
        this.cdr.markForCheck();
      }
    });
  }

  trackByProfile(_: number, profile: AccessProfileResponse): string {
    return profile.id;
  }

  private reloadUsers(): void {
    this.userService.listUsers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: users => {
        this.users = users.sort((left, right) => left.username.localeCompare(right.username));
        this.collapsedUserIds = new Set(this.users.map(user => user.id));
        this.cdr.markForCheck();
      },
      error: () => undefined
    });
  }

  private patchUser(updated: UserResponse): void {
    this.users = this.users
      .map(user => user.id === updated.id ? updated : user)
      .sort((left, right) => left.username.localeCompare(right.username));
  }

  private ensureCreateProfileSelection(preferredProfileId?: string): void {
    const currentProfileId = this.createForm.controls.profileId.value;
    const selectedProfileId = preferredProfileId
      ?? currentProfileId
      ?? this.profiles[0]?.id
      ?? '';
    const exists = this.profiles.some(profile => profile.id === selectedProfileId);
    this.createForm.controls.profileId.setValue(exists ? selectedProfileId : this.profiles[0]?.id ?? '');
  }

  private buildPermissionCategories(): string[] {
    const categories = this.permissionCatalog
      .map(permission => this.permissionCategoryOf(permission.label))
      .filter((category, index, all) => all.indexOf(category) === index);

    return ['Todas', ...categories];
  }

  private permissionCategoryOf(label: string): string {
    return label.split(':')[0]?.trim() || 'General';
  }
}
