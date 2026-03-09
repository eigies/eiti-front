import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { RoleDefinition, UserResponse } from '../../core/models/user.models';
import { RoleService } from '../../core/services/role.service';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NavbarComponent],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit {
  readonly createForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  users: UserResponse[] = [];
  roles: RoleDefinition[] = [];
  loading = true;
  savingCreate = false;
  private readonly createRoleCodes = new Set<string>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly userService: UserService,
    private readonly roleService: RoleService,
    private readonly toast: ToastService
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  get activeUsersCount(): number {
    return this.users.filter(user => user.isActive).length;
  }

  get selectedCreateRolesLabel(): string {
    return this.createRoleCodes.size > 0
      ? `Roles seleccionados: ${[...this.createRoleCodes].join(', ')}`
      : 'Selecciona al menos un rol para habilitar permisos.';
  }

  loadData(): void {
    this.loading = true;
    this.roleService.listRoles().subscribe({
      next: roles => {
        this.roles = roles;
        if (this.createRoleCodes.size === 0) {
          const defaultRole = roles.find(role => role.code === 'seller')?.code ?? roles[0]?.code;
          if (defaultRole) {
            this.createRoleCodes.add(defaultRole);
          }
        }
      },
      error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar los roles')
    });

    this.userService.listUsers().subscribe({
      next: users => {
        this.users = users;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar los usuarios');
      }
    });
  }

  isRoleSelected(roleCode: string): boolean {
    return this.createRoleCodes.has(roleCode);
  }

  toggleCreateRole(roleCode: string): void {
    if (this.createRoleCodes.has(roleCode)) {
      if (this.createRoleCodes.size === 1) {
        return;
      }
      this.createRoleCodes.delete(roleCode);
      return;
    }

    this.createRoleCodes.add(roleCode);
  }

  createUser(): void {
    if (this.createForm.invalid || this.createRoleCodes.size === 0) {
      this.createForm.markAllAsTouched();
      this.toast.error('Completa usuario, email, password y al menos un rol.');
      return;
    }

    const raw = this.createForm.getRawValue();
    this.savingCreate = true;
    this.userService.createUser({
      username: String(raw.username || '').trim(),
      email: String(raw.email || '').trim(),
      password: String(raw.password || ''),
      roleCodes: [...this.createRoleCodes],
      employeeId: null
    }).subscribe({
      next: user => {
        this.users = [user, ...this.users].sort((left, right) => left.username.localeCompare(right.username));
        this.createForm.reset({ username: '', email: '', password: '' });
        this.savingCreate = false;
        this.toast.success('Usuario creado');
      },
      error: err => {
        this.savingCreate = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo crear el usuario');
      }
    });
  }

  hasRole(user: UserResponse, roleCode: string): boolean {
    return user.roles.includes(roleCode);
  }

  toggleUserRole(user: UserResponse, roleCode: string): void {
    const nextRoles = user.roles.includes(roleCode)
      ? user.roles.filter(code => code !== roleCode)
      : [...user.roles, roleCode];

    if (nextRoles.length === 0) {
      this.toast.error('El usuario debe conservar al menos un rol.');
      return;
    }

    this.persistRoles(user, nextRoles);
  }

  toggleStatus(user: UserResponse): void {
    this.userService.setStatus(user.id, !user.isActive).subscribe({
      next: updated => {
        this.patchUser(updated);
        this.toast.success(updated.isActive ? 'Usuario activado' : 'Usuario desactivado');
      },
      error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo actualizar el estado')
    });
  }

  private persistRoles(user: UserResponse, roleCodes: string[]): void {
    this.userService.updateRoles(user.id, { roleCodes, employeeId: user.employeeId || null }).subscribe({
      next: updated => {
        this.patchUser(updated);
        this.toast.success('Permisos actualizados');
      },
      error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron actualizar los roles')
    });
  }

  private patchUser(updated: UserResponse): void {
    this.users = this.users
      .map(user => user.id === updated.id ? updated : user)
      .sort((left, right) => left.username.localeCompare(right.username));
  }
}
