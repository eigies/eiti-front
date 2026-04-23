import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent {
  step: 1 | 2 = 1;
  loading = false;
  showPass = false;
  showConfirm = false;
  lines = Array.from({ length: 30 }, (_, i) => i);

  emailForm: FormGroup;
  resetForm: FormGroup;

  private emailValue = '';

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private toast: ToastService
  ) {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.resetForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern(/^\d{6}$/)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordsMatch });
  }

  isInvalid(form: FormGroup, field: string): boolean {
    const c = form.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  get passwordsMismatch(): boolean {
    const f = this.resetForm;
    return f.hasError('mismatch') && (f.get('confirmPassword')?.dirty || f.get('confirmPassword')?.touched) === true;
  }

  private passwordsMatch(group: FormGroup) {
    const pw = group.get('newPassword')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pw === confirm ? null : { mismatch: true };
  }

  submitEmail(): void {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.emailValue = this.emailForm.value.email;
    this.auth.requestPasswordReset({ email: this.emailValue }).subscribe({
      next: () => {
        this.loading = false;
        this.step = 2;
        this.toast.success('Si el email existe, recibirás un código en instantes');
      },
      error: () => {
        this.loading = false;
        this.step = 2;
        this.toast.success('Si el email existe, recibirás un código en instantes');
      }
    });
  }

  submitReset(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.auth.resetPassword({
      email: this.emailValue,
      code: this.resetForm.value.code,
      newPassword: this.resetForm.value.newPassword
    }).subscribe({
      next: () => {
        this.toast.success('Contraseña actualizada. Iniciá sesión con tu nueva contraseña.');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        const msg = err?.error?.message || 'El código es inválido o ha expirado';
        this.toast.error(msg);
        this.loading = false;
      }
    });
  }

  goBack(): void {
    this.step = 1;
    this.resetForm.reset();
  }
}
