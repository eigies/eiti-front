import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  form: FormGroup;
  loading = false;
  showPass = false;
  cells = Array.from({ length: 80 }, (_, i) => i);

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private toast: ToastService
  ) {
    this.form = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      companyName: ['', [Validators.required, Validators.maxLength(100)]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  get strengthClass(): string {
    const pass = this.form.get('password')?.value || '';
    if (pass.length < 6) return 'weak';
    if (pass.length < 10) return 'fair';
    return 'strong';
  }

  get strengthLabel(): string {
    const map: Record<string, string> = { weak: 'Debil', fair: 'Media', strong: 'Fuerte' };
    return map[this.strengthClass];
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
    this.auth.register(this.form.value).subscribe({
      next: () => {
        this.toast.success('Cuenta creada. Ahora podes iniciar sesion');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al registrar. Intenta nuevamente.';
        this.toast.error(msg);
        this.loading = false;
      }
    });
  }
}
