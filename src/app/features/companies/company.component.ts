import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { CompanyService } from '../../core/services/company.service';
import { CompanyResponse } from '../../core/models/company.models';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-company',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NavbarComponent],
  templateUrl: './company.component.html',
  styleUrls: ['./company.component.css']
})
export class CompanyComponent implements OnInit {
  form: FormGroup;
  company: CompanyResponse | null = null;
  loading = false;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private companyService: CompanyService,
    private toast: ToastService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      primaryDomain: ['', [Validators.required, Validators.maxLength(255)]]
    });
  }

  ngOnInit(): void {
    this.loadCompany();
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.companyService.updateCurrentCompany(this.form.getRawValue()).subscribe({
      next: (company) => {
        this.company = company;
        this.form.patchValue(company);
        this.toast.success('Datos de compania actualizados');
        this.saving = false;
      },
      error: (err) => {
        const message = err?.error?.message || 'No se pudo actualizar la compania';
        this.toast.error(message);
        this.saving = false;
      }
    });
  }

  private loadCompany(): void {
    this.loading = true;
    this.companyService.getCurrentCompany().subscribe({
      next: (company) => {
        this.company = company;
        this.form.patchValue(company);
        this.loading = false;
      },
      error: (err) => {
        const message = err?.error?.message || 'No se pudieron cargar los datos de compania';
        this.toast.error(message);
        this.loading = false;
      }
    });
  }
}
