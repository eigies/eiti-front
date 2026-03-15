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
      primaryDomain: ['', [Validators.required, Validators.maxLength(255)]],
      whatsAppEnabled: [false],
      whatsAppPhoneNumber: [''],
      defaultNoDeliverySurcharge: [null, [Validators.min(0)]]
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

    if (this.form.get('whatsAppEnabled')?.value && !String(this.form.get('whatsAppPhoneNumber')?.value || '').trim()) {
      this.form.get('whatsAppPhoneNumber')?.markAsTouched();
      this.toast.error('Configura el numero emisor de WhatsApp para activar el envio automatico.');
      return;
    }

    this.saving = true;
    const rawSurcharge = this.form.get('defaultNoDeliverySurcharge')?.value;
    this.companyService.updateCurrentCompany({
      name: String(this.form.get('name')?.value || ''),
      primaryDomain: String(this.form.get('primaryDomain')?.value || ''),
      isWhatsAppEnabled: Boolean(this.form.get('whatsAppEnabled')?.value),
      whatsAppSenderPhone: this.nullIfEmpty(this.form.get('whatsAppPhoneNumber')?.value),
      defaultNoDeliverySurcharge: rawSurcharge === null || rawSurcharge === '' ? null : Number(rawSurcharge)
    }).subscribe({
      next: (company) => {
        this.company = company;
        this.form.patchValue(this.mapCompanyToForm(company));
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
        this.form.patchValue(this.mapCompanyToForm(company));
        this.loading = false;
      },
      error: (err) => {
        const message = err?.error?.message || 'No se pudieron cargar los datos de compania';
        this.toast.error(message);
        this.loading = false;
      }
    });
  }

  private nullIfEmpty(value: string | null | undefined): string | null {
    return value && value.trim().length > 0 ? value.trim() : null;
  }

  private mapCompanyToForm(company: CompanyResponse) {
    return {
      name: company.name,
      primaryDomain: company.primaryDomain,
      whatsAppEnabled: Boolean(company.isWhatsAppEnabled ?? company.whatsAppEnabled),
      whatsAppPhoneNumber: company.whatsAppSenderPhone ?? company.whatsAppPhoneNumber ?? '',
      defaultNoDeliverySurcharge: company.defaultNoDeliverySurcharge ?? null
    };
  }
}
