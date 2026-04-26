import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { CashService } from '../../../core/services/cash.service';
import { PermissionCodes } from '../../../core/models/permission.models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  form: FormGroup;
  loading = false;
  showPass = false;
  lines = Array.from({ length: 30 }, (_, i) => i);

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private toast: ToastService,
    private cashService: CashService
  ) {
    this.form = this.fb.group({
      usernameOrEmail: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  private checkStaleCashSessions(): void {
    if (!this.auth.hasPermission(PermissionCodes.cashAccess)) return;
    this.cashService.getStaleOpenSessions().subscribe({
      next: (sessions) => {
        if (sessions.length === 0) return;
        const msg = sessions.length === 1
          ? `Hay 1 caja abierta hace mas de 20 horas. Recorda cerrarla.`
          : `Hay ${sessions.length} cajas abiertas hace mas de 20 horas. Recorda cerrarlas.`;
        this.toast.show(msg, 'info', 9000);
      }
    });
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.auth.login(this.form.value).subscribe({
      next: () => {
        this.toast.success('Bienvenido de vuelta');
        this.checkStaleCashSessions();
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Credenciales invalidas';
        this.toast.error(msg);
        this.loading = false;
      }
    });
  }
}
