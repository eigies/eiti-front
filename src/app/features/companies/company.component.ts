import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CompanyService } from '../../core/services/company.service';
import { CompanyResponse } from '../../core/models/company.models';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-company',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './company.component.html',
  styleUrls: ['./company.component.css']
})
export class CompanyComponent implements OnInit {
  form: FormGroup;
  company: CompanyResponse | null = null;
  loading = false;
  saving = false;
  readonly maxPdfImageBytes = 700_000;

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
      defaultNoDeliverySurcharge: [null, [Validators.min(0)]],
      pdfLogoUrl: [''],
      pdfWatermarkUrl: ['']
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
      defaultNoDeliverySurcharge: rawSurcharge === null || rawSurcharge === '' ? null : Number(rawSurcharge),
      pdfLogoUrl: this.nullIfEmpty(this.form.get('pdfLogoUrl')?.value),
      pdfWatermarkUrl: this.nullIfEmpty(this.form.get('pdfWatermarkUrl')?.value)
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

  imagePreview(field: 'pdfLogoUrl' | 'pdfWatermarkUrl'): string | null {
    return this.nullIfEmpty(this.form.get(field)?.value);
  }

  clearImage(field: 'pdfLogoUrl' | 'pdfWatermarkUrl'): void {
    this.form.get(field)?.setValue('');
    this.form.get(field)?.markAsDirty();
  }

  onImageSelected(field: 'pdfLogoUrl' | 'pdfWatermarkUrl', event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.toast.error('Selecciona una imagen PNG o JPG.');
      return;
    }

    if (file.size > this.maxPdfImageBytes) {
      this.toast.error('La imagen debe pesar menos de 700 KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.form.get(field)?.setValue(String(reader.result || ''));
      this.form.get(field)?.markAsDirty();
    };
    reader.onerror = () => this.toast.error('No se pudo leer la imagen.');
    reader.readAsDataURL(file);
  }

  private mapCompanyToForm(company: CompanyResponse) {
    return {
      name: company.name,
      primaryDomain: company.primaryDomain,
      whatsAppEnabled: Boolean(company.isWhatsAppEnabled ?? company.whatsAppEnabled),
      whatsAppPhoneNumber: company.whatsAppSenderPhone ?? company.whatsAppPhoneNumber ?? '',
      defaultNoDeliverySurcharge: company.defaultNoDeliverySurcharge ?? null,
      pdfLogoUrl: company.pdfLogoUrl ?? '',
      pdfWatermarkUrl: company.pdfWatermarkUrl ?? ''
    };
  }
}
