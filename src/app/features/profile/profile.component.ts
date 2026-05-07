import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PermissionCodes } from '../../core/models/permission.models';
import { UserProfileAuditResponse, UserResponse } from '../../core/models/user.models';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent implements OnInit {
  profile: UserResponse | null = null;
  audits: UserProfileAuditResponse[] = [];
  loadingAudit = false;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    public readonly auth: AuthService,
    private readonly userService: UserService,
    private readonly toast: ToastService
  ) { }

  get canReadAllAudits(): boolean {
    return this.auth.hasPermission(PermissionCodes.usersManage);
  }

  ngOnInit(): void {
    this.loadProfile();
    this.reloadAudit();
  }

  reloadAudit(): void {
    this.loadingAudit = true;
    const userId = this.canReadAllAudits ? null : this.auth.currentUser?.userId ?? null;

    this.userService.listProfileAudits(userId, 40).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: audits => {
        this.audits = audits;
        this.loadingAudit = false;
      },
      error: err => {
        this.loadingAudit = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo cargar la auditoria');
      }
    });
  }

  auditProfileName(value?: string | null): string {
    return value?.trim() || 'Sin perfil';
  }

  formatPermissions(permissions?: string[]): string {
    if (!permissions || permissions.length === 0) {
      return '-';
    }

    return permissions.join(', ');
  }

  private loadProfile(): void {
    this.userService.getMyProfile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: profile => {
        this.profile = profile;
      },
      error: err => {
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo cargar el perfil');
      }
    });
  }
}
