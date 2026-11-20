import { Injectable, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { AccessProfileResponse } from '../../../core/models/access-profile.models';
import { BranchResponse } from '../../../core/models/branch.models';
import { PermissionCatalog } from '../../../core/models/permission.models';
import { UserResponse } from '../../../core/models/user.models';
import { AccessProfileService } from '../../../core/services/access-profile.service';
import { AuthService } from '../../../core/services/auth.service';
import { BranchService } from '../../../core/services/branch.service';
import { UserService } from '../../../core/services/user.service';
import { ConfirmationService } from '../../../shared/services/confirmation.service';
import { ToastService } from '../../../shared/services/toast.service';
import {
  AccessPanelMode,
  AccessProfileDraft,
  AccessSection,
  profileUsageCount,
  UserAccessDraft
} from '../users-ui.models';

/**
 * Estado y reglas de Usuarios y perfiles. Movido tal cual desde UsersComponent:
 * mismas llamadas, validaciones, confirmaciones y mensajes. La página solo conecta.
 */
@Injectable()
export class UsersFacade implements OnDestroy {
  /** Avisa que el popup de usuario terminó de cerrarse (con el id recién creado, si hubo alta). */
  readonly userPanelClosed$ = new Subject<string | undefined>();

  readonly permissionCatalog = PermissionCatalog;

  users: UserResponse[] = [];
  profiles: AccessProfileResponse[] = [];
  branches: BranchResponse[] = [];

  activeSection: AccessSection = 'users';
  userPanelMode: AccessPanelMode = 'closed';
  selectedUser: UserResponse | null = null;
  userPanelSaving = false;
  userPanelClosing = false;
  profilePanelMode: AccessPanelMode = 'closed';
  selectedProfile: AccessProfileResponse | null = null;
  profilePanelSaving = false;
  profilePanelClosing = false;

  loadingUsers = true;
  loadingProfiles = true;
  usersLoadError: string | null = null;
  profilesLoadError: string | null = null;

  private readonly destroy$ = new Subject<void>();
  private destroyed = false;
  private userPanelCloseRequestId = 0;
  private profilePanelCloseRequestId = 0;
  private statusRequestId = 0;
  private profileDeleteRequestId = 0;
  private userPanelCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private profilePanelCloseTimer: ReturnType<typeof setTimeout> | null = null;
  /** Lo que tarda en salir el popup (motion EITI 2: 120 ms). */
  readonly panelExitDuration = 120;

  constructor(
    private readonly userService: UserService,
    private readonly accessProfileService: AccessProfileService,
    private readonly toast: ToastService,
    private readonly auth: AuthService,
    private readonly branchService: BranchService,
    private readonly confirmation: ConfirmationService
  ) {}

  init(): void {
    this.loadData();
    this.branchService.listBranches()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: branches => {
          this.branches = branches;
        },
        error: () => {}
      });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clearUserPanelCloseTimer();
    this.clearProfilePanelCloseTimer();
    this.userPanelCloseRequestId++;
    this.profilePanelCloseRequestId++;
    this.statusRequestId++;
    this.profileDeleteRequestId++;
    this.destroy$.next();
    this.destroy$.complete();
  }

  get activeUsersCount(): number {
    return this.users.filter(user => user.isActive).length;
  }

  get loading(): boolean {
    return this.loadingUsers || this.loadingProfiles;
  }

  loadData(): void {
    this.loadProfiles();
    this.loadUsers();
  }

  loadProfiles(): void {
    this.loadingProfiles = true;
    this.profilesLoadError = null;
    this.accessProfileService.listAccessProfiles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: profiles => {
          this.profiles = [...profiles]
            .sort((left, right) => left.name.localeCompare(right.name));
          this.loadingProfiles = false;
        },
        error: error => {
          this.loadingProfiles = false;
          this.profilesLoadError = this.loadErrorMessage(
            error,
            'No se pudieron cargar los perfiles'
          );
          this.toast.error(this.profilesLoadError);
        }
      });
  }

  loadUsers(): void {
    this.loadingUsers = true;
    this.usersLoadError = null;
    this.userService.listUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: users => {
          this.users = [...users]
            .sort((left, right) => left.username.localeCompare(right.username));
          this.loadingUsers = false;
        },
        error: error => {
          this.loadingUsers = false;
          this.usersLoadError = this.loadErrorMessage(
            error,
            'No se pudieron cargar los usuarios'
          );
          this.toast.error(this.usersLoadError);
        }
      });
  }

  openUserCreator(): void {
    this.clearUserPanelCloseTimer();
    this.userPanelClosing = false;
    this.userPanelCloseRequestId++;
    this.selectedUser = null;
    this.userPanelMode = 'create';
  }

  openUserEditor(user: UserResponse): void {
    this.clearUserPanelCloseTimer();
    this.userPanelClosing = false;
    this.userPanelCloseRequestId++;
    this.selectedUser = user;
    this.userPanelMode = 'edit';
  }

  saveUserDraft(draft: UserAccessDraft): void {
    if (this.userPanelSaving || this.userPanelClosing || this.userPanelMode === 'closed') return;

    this.userPanelSaving = true;
    if (this.userPanelMode === 'create') {
      this.userService.createUser({
        ...draft,
        employeeId: null
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: created => {
          this.users = [...this.users, created]
            .sort((left, right) => left.username.localeCompare(right.username));
          this.userPanelSaving = false;
          this.beginUserPanelClose(created.id);
          this.toast.success('Usuario creado');
        },
        error: error => {
          this.userPanelSaving = false;
          this.toast.error(
            error?.error?.detail || error?.error?.message || 'No se pudo crear el usuario'
          );
        }
      });
      return;
    }

    const selected = this.selectedUser;
    if (!selected) {
      this.userPanelSaving = false;
      return;
    }

    this.userService.updateProfile(selected.id, {
      firstName: draft.firstName,
      lastName: draft.lastName,
      profileId: draft.profileId,
      employeeId: null,
      isEmployee: draft.isEmployee,
      branchIds: draft.branchIds
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: updated => {
        this.patchUser(updated);
        this.userPanelSaving = false;
        this.beginUserPanelClose();
        this.toast.success('Acceso actualizado');
        this.auth.refreshCurrentUserProfile();
      },
      error: error => {
        this.userPanelSaving = false;
        this.toast.error(
          error?.error?.detail || error?.error?.message || 'No se pudo actualizar el acceso'
        );
      }
    });
  }

  async requestUserPanelClose(dirty: boolean): Promise<void> {
    if (this.userPanelSaving || this.userPanelClosing || this.userPanelMode === 'closed') return;

    const requestId = ++this.userPanelCloseRequestId;
    const expectedMode = this.userPanelMode;
    const expectedUserId = this.selectedUser?.id ?? null;
    if (dirty) {
      const confirmed = await this.confirmation.confirm({
        eyebrow: 'Cambios sin guardar',
        title: 'Descartar cambios',
        message: 'Hay cambios en el acceso de este usuario.',
        detail: 'Si cerrás el panel, los cambios no se guardarán.',
        confirmLabel: 'Descartar cambios',
        cancelLabel: 'Seguir editando',
        tone: 'warning'
      });
      if (
        !confirmed
        || !this.isCurrentUserPanelRequest(requestId, expectedMode, expectedUserId)
      ) return;
    }

    if (!this.isCurrentUserPanelRequest(requestId, expectedMode, expectedUserId)) return;
    this.beginUserPanelClose();
  }

  async requestUserStatusChange(user: UserResponse): Promise<void> {
    const requestId = ++this.statusRequestId;
    if (user.isActive) {
      const confirmed = await this.confirmation.confirm({
        eyebrow: 'Estado del usuario',
        title: 'Desactivar usuario',
        message: `Se desactivará el acceso de "${user.username}".`,
        detail: 'La persona no podrá ingresar hasta que vuelvas a activarla.',
        confirmLabel: 'Desactivar usuario',
        tone: 'danger'
      });
      if (!confirmed || this.destroyed || requestId !== this.statusRequestId) return;
    }

    if (this.destroyed || requestId !== this.statusRequestId) return;
    const current = this.users.find(candidate => candidate.id === user.id);
    if (!current || current.isActive !== user.isActive) return;
    this.toggleStatus(current);
  }

  toggleStatus(user: UserResponse): void {
    this.userService.setStatus(user.id, !user.isActive)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: updated => {
          this.patchUser(updated);
          this.toast.success(updated.isActive ? 'Usuario activado' : 'Usuario desactivado');
        },
        error: error => {
          this.toast.error(
            error?.error?.detail || error?.error?.message || 'No se pudo actualizar el estado'
          );
        }
      });
  }

  openProfileCreator(): void {
    this.clearProfilePanelCloseTimer();
    this.profilePanelClosing = false;
    this.profilePanelCloseRequestId++;
    this.selectedProfile = null;
    this.profilePanelMode = 'create';
  }

  openProfileEditor(profile: AccessProfileResponse): void {
    this.clearProfilePanelCloseTimer();
    this.profilePanelClosing = false;
    this.profilePanelCloseRequestId++;
    this.selectedProfile = profile;
    this.profilePanelMode = 'edit';
  }

  profileUsage(profileId: string): number {
    return profileUsageCount(profileId, this.users);
  }

  async requestProfilePanelClose(dirty: boolean): Promise<void> {
    if (this.profilePanelSaving || this.profilePanelClosing || this.profilePanelMode === 'closed') return;

    const requestId = ++this.profilePanelCloseRequestId;
    const expectedMode = this.profilePanelMode;
    const expectedProfileId = this.selectedProfile?.id ?? null;
    if (dirty) {
      const confirmed = await this.confirmation.confirm({
        eyebrow: 'Cambios sin guardar',
        title: 'Cerrar edición de perfil',
        message: 'Los cambios del perfil se perderán.',
        confirmLabel: 'Descartar cambios',
        cancelLabel: 'Seguir editando',
        tone: 'warning'
      });
      if (
        !confirmed
        || !this.isCurrentProfilePanelRequest(requestId, expectedMode, expectedProfileId)
      ) return;
    }

    if (!this.isCurrentProfilePanelRequest(requestId, expectedMode, expectedProfileId)) return;
    this.beginProfilePanelClose();
  }

  saveProfileDraft(draft: AccessProfileDraft): void {
    if (this.profilePanelSaving || this.profilePanelClosing || this.profilePanelMode === 'closed') return;

    const editingProfileId = this.selectedProfile?.id;
    this.profilePanelSaving = true;
    const action = editingProfileId
      ? this.accessProfileService.updateAccessProfile(editingProfileId, draft)
      : this.accessProfileService.createAccessProfile(draft);

    action.pipe(takeUntil(this.destroy$)).subscribe({
      next: profile => {
        this.profiles = [...this.profiles.filter(item => item.id !== profile.id), profile]
          .sort((left, right) => left.name.localeCompare(right.name));
        this.profilePanelSaving = false;
        this.beginProfilePanelClose();
        this.toast.success(editingProfileId ? 'Perfil actualizado' : 'Perfil creado');
        this.loadUsers();
        this.auth.refreshCurrentUserProfile();
      },
      error: error => {
        this.profilePanelSaving = false;
        this.toast.error(
          error?.error?.detail || error?.error?.message || 'No se pudo guardar el perfil'
        );
      }
    });
  }

  async deleteProfile(profile: AccessProfileResponse): Promise<void> {
    const requestId = ++this.profileDeleteRequestId;
    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Administración de acceso',
      title: 'Eliminar perfil',
      message: `Se eliminará el perfil "${profile.name}".`,
      detail: 'Los usuarios no podrán volver a ser asignados a este perfil.',
      confirmLabel: 'Eliminar perfil',
      tone: 'danger'
    });
    if (
      !confirmed
      || this.destroyed
      || requestId !== this.profileDeleteRequestId
      || !this.profiles.some(candidate => candidate.id === profile.id)
    ) return;

    this.accessProfileService.deleteAccessProfile(profile.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.profiles = this.profiles.filter(item => item.id !== profile.id);
          if (this.selectedProfile?.id === profile.id) this.beginProfilePanelClose();
          this.toast.success('Perfil eliminado');
        },
        error: error => {
          this.toast.error(
            error?.error?.detail || error?.error?.message || 'No se pudo eliminar el perfil'
          );
        }
      });
  }

  selectSection(sectionId: AccessSection): void {
    if (this.userPanelMode !== 'closed' || this.profilePanelMode !== 'closed') return;
    this.activeSection = sectionId;
  }

  private patchUser(updated: UserResponse): void {
    this.users = this.users
      .map(user => user.id === updated.id ? updated : user)
      .sort((left, right) => left.username.localeCompare(right.username));
  }

  private beginUserPanelClose(preferredUserId?: string): void {
    if (this.userPanelClosing || this.userPanelMode === 'closed') return;
    this.userPanelCloseRequestId++;
    this.userPanelClosing = true;
    this.userPanelCloseTimer = setTimeout(() => {
      this.userPanelCloseTimer = null;
      this.userPanelClosing = false;
      this.finalizeUserPanelClose(preferredUserId);
    }, this.panelExitDuration);
  }

  private finalizeUserPanelClose(preferredUserId?: string): void {
    this.userPanelCloseRequestId++;
    this.userPanelMode = 'closed';
    this.selectedUser = null;
    this.userPanelClosed$.next(preferredUserId);
  }

  private beginProfilePanelClose(): void {
    if (this.profilePanelClosing || this.profilePanelMode === 'closed') return;
    this.profilePanelCloseRequestId++;
    this.profilePanelClosing = true;
    this.profilePanelCloseTimer = setTimeout(() => {
      this.profilePanelCloseTimer = null;
      this.profilePanelClosing = false;
      this.finalizeProfilePanelClose();
    }, this.panelExitDuration);
  }

  private finalizeProfilePanelClose(): void {
    this.profilePanelCloseRequestId++;
    this.profilePanelMode = 'closed';
    this.selectedProfile = null;
  }

  private clearUserPanelCloseTimer(): void {
    if (this.userPanelCloseTimer === null) return;
    clearTimeout(this.userPanelCloseTimer);
    this.userPanelCloseTimer = null;
  }

  private clearProfilePanelCloseTimer(): void {
    if (this.profilePanelCloseTimer === null) return;
    clearTimeout(this.profilePanelCloseTimer);
    this.profilePanelCloseTimer = null;
  }

  private isCurrentUserPanelRequest(
    requestId: number,
    expectedMode: AccessPanelMode,
    expectedUserId: string | null
  ): boolean {
    return !this.destroyed
      && requestId === this.userPanelCloseRequestId
      && !this.userPanelClosing
      && this.userPanelMode === expectedMode
      && (this.selectedUser?.id ?? null) === expectedUserId;
  }

  private isCurrentProfilePanelRequest(
    requestId: number,
    expectedMode: AccessPanelMode,
    expectedProfileId: string | null
  ): boolean {
    return !this.destroyed
      && requestId === this.profilePanelCloseRequestId
      && !this.profilePanelClosing
      && this.profilePanelMode === expectedMode
      && (this.selectedProfile?.id ?? null) === expectedProfileId;
  }

  private loadErrorMessage(error: unknown, fallback: string): string {
    const response = error as {
      error?: { detail?: string; message?: string };
    } | null;
    return response?.error?.detail || response?.error?.message || fallback;
  }
}
