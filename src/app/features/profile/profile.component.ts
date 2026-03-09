import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { AuthService } from '../../core/services/auth.service';
import { PermissionCodes } from '../../core/models/permission.models';
import { UserRoleAuditResponse, UserResponse } from '../../core/models/user.models';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  profile: UserResponse | null = null;
  audits: UserRoleAuditResponse[] = [];
  loadingAudit = false;

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

    this.userService.listRoleAudits(userId, 40).subscribe({
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

  formatRoles(roles: string[]): string {
    if (!roles || roles.length === 0) {
      return '-';
    }

    return roles.join(', ');
  }

  private loadProfile(): void {
    this.userService.getMyProfile().subscribe({
      next: profile => {
        this.profile = profile;
      },
      error: err => {
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo cargar el perfil');
      }
    });
  }
}
