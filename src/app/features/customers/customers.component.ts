import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { CustomerService } from '../../core/services/customer.service';
import { CreateCustomerRequest, CustomerResponse } from '../../core/models/customer.models';
import { ToastService } from '../../shared/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { PermissionCodes } from '../../core/models/permission.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';
import { ConfirmationService } from '../../shared/services/confirmation.service';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SearchableSelectComponent],
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.css']
})
export class CustomersComponent implements OnInit, OnDestroy {
  form: FormGroup;
  customers: CustomerResponse[] = [];
  searchTerm = '';
  creating = false;
  formPanelOpen = false;
  formPanelClosing = false;
  editingId: string | null = null;
  deletingId: string | null = null;
  private formPanelCloseTimer: ReturnType<typeof setTimeout> | null = null;
  readonly documentTypes = [
    { value: 1, label: 'DNI' },
    { value: 2, label: 'Pasaporte' },
    { value: 3, label: 'LE' },
    { value: 4, label: 'LC' },
    { value: 5, label: 'Otro' }
  ];

  readonly documentTypeOptions: SearchableSelectOption[] = this.documentTypes.map(type => ({
    value: type.value,
    label: type.label
  }));

  constructor(
    private fb: FormBuilder,
    private customerService: CustomerService,
    private toast: ToastService,
    private auth: AuthService,
    private confirmation: ConfirmationService
  ) {
    this.form = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      documentType: [1, Validators.required],
      documentNumber: ['', Validators.required],
      taxId: [''],
      street: ['', Validators.required],
      streetNumber: ['', Validators.required],
      postalCode: ['', Validators.required],
      city: ['', Validators.required],
      stateOrProvince: ['', Validators.required],
      country: ['Argentina', Validators.required],
      floor: [''],
      apartment: [''],
      reference: ['']
    });
  }

  ngOnInit(): void {
    this.loadCustomers();
  }

  ngOnDestroy(): void {
    this.clearFormPanelCloseTimer();
  }

  get canDeleteCustomers(): boolean {
    return this.auth.hasPermission(PermissionCodes.customersDelete);
  }

  get isEditing(): boolean {
    return this.editingId !== null;
  }

  get filteredCustomers(): CustomerResponse[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.customers;
    }
    const digits = term.replace(/\D/g, '');
    return this.customers.filter(c => {
      const haystack = [c.name, c.email, c.phone, c.documentNumber, c.taxId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (haystack.includes(term)) {
        return true;
      }
      if (digits.length > 0) {
        const phoneDigits = (c.phone ?? '').replace(/\D/g, '');
        const docDigits = (c.documentNumber ?? '').replace(/\D/g, '');
        return phoneDigits.includes(digits) || docDigits.includes(digits);
      }
      return false;
    });
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.creating = true;
    const payload = this.buildPayload();
    const wasEditing = this.editingId !== null;
    const request$ = wasEditing
      ? this.customerService.updateCustomer({ ...payload, id: this.editingId! })
      : this.customerService.createCustomer(payload);

    request$.subscribe({
      next: (c) => {
        this.creating = false;
        this.closeFormPanel();
        this.toast.success(wasEditing
          ? `Cliente "${c.name}" actualizado correctamente`
          : `Cliente "${c.name}" creado correctamente`);
        this.loadCustomers();
      },
      error: (err) => {
        this.creating = false;
        this.toast.error(this.resolveCustomerErrorMessage(err, wasEditing ? 'Error al actualizar el cliente' : 'Error al crear el cliente'));
      }
    });
  }

  openCreatePanel(): void {
    this.clearFormPanelCloseTimer();
    this.resetForm();
    this.formPanelOpen = true;
    this.formPanelClosing = false;
  }

  beginEdit(customer: CustomerResponse): void {
    this.customerService.getCustomerById(customer.id).subscribe({
      next: (c) => {
        this.editingId = c.id;
        this.form.reset({
          firstName: c.firstName || '',
          lastName: c.lastName || '',
          email: c.email || '',
          phone: c.phone || '',
          documentType: c.documentType ?? 1,
          documentNumber: c.documentNumber || '',
          taxId: c.taxId || '',
          street: c.address?.street || '',
          streetNumber: c.address?.streetNumber || '',
          postalCode: c.address?.postalCode || '',
          city: c.address?.city || '',
          stateOrProvince: c.address?.stateOrProvince || '',
          country: c.address?.country || 'Argentina',
          floor: c.address?.floor || '',
          apartment: c.address?.apartment || '',
          reference: c.address?.reference || ''
        });
        this.clearFormPanelCloseTimer();
        this.formPanelOpen = true;
        this.formPanelClosing = false;
      },
      error: (err) => this.toast.error(this.resolveCustomerErrorMessage(err, 'No se pudo cargar el cliente para editar'))
    });
  }

  cancelEdit(): void {
    this.closeFormPanel();
  }

  async deleteCustomer(customer: CustomerResponse): Promise<void> {
    if (this.deletingId) { return; }
    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Base de clientes',
      title: 'Eliminar cliente',
      message: `Vas a eliminar al cliente "${customer.name}".`,
      detail: 'Esta accion no se puede deshacer.',
      confirmLabel: 'Eliminar cliente',
      tone: 'danger'
    });
    if (!confirmed) { return; }

    this.deletingId = customer.id;
    this.customerService.deleteCustomer(customer.id).subscribe({
      next: () => {
        this.deletingId = null;
        if (this.editingId === customer.id) { this.closeFormPanel(); }
        this.toast.success('Cliente eliminado');
        this.loadCustomers();
      },
      error: (err) => {
        this.deletingId = null;
        this.toast.error(this.resolveCustomerErrorMessage(err, 'No se pudo eliminar el cliente'));
      }
    });
  }

  customerInitial(customer: CustomerResponse): string {
    const source = customer.name || customer.fullName || customer.email || '?';
    return source.charAt(0).toUpperCase();
  }

  formatDocument(customer: CustomerResponse): string {
    const documentNumber = customer.documentNumber?.trim();
    const taxId = customer.taxId?.trim();
    const documentLabel = customer.documentTypeName || 'Doc.';
    const parts = [
      documentNumber ? `${documentLabel} ${documentNumber}` : null,
      taxId ? `CUIT ${taxId}` : null
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : 'Sin documento';
  }

  private closeFormPanel(): void {
    if (!this.formPanelOpen || this.formPanelClosing) { return; }
    this.formPanelClosing = true;
    this.clearFormPanelCloseTimer();
    this.formPanelCloseTimer = setTimeout(() => {
      this.formPanelOpen = false;
      this.formPanelClosing = false;
      this.resetForm();
      this.formPanelCloseTimer = null;
    }, 240);
  }

  private clearFormPanelCloseTimer(): void {
    if (!this.formPanelCloseTimer) { return; }
    clearTimeout(this.formPanelCloseTimer);
    this.formPanelCloseTimer = null;
  }

  private buildPayload(): CreateCustomerRequest {
    const raw = this.form.getRawValue();
    return {
      name: `${raw.firstName} ${raw.lastName}`.trim(),
      firstName: String(raw.firstName || ''),
      lastName: String(raw.lastName || ''),
      email: String(raw.email || ''),
      phone: String(raw.phone || ''),
      documentType: Number(raw.documentType),
      documentNumber: String(raw.documentNumber || ''),
      taxId: this.nullIfEmpty(raw.taxId),
      address: {
        street: String(raw.street || ''),
        streetNumber: String(raw.streetNumber || ''),
        postalCode: String(raw.postalCode || ''),
        city: String(raw.city || ''),
        stateOrProvince: String(raw.stateOrProvince || ''),
        country: String(raw.country || ''),
        floor: this.nullIfEmpty(raw.floor),
        apartment: this.nullIfEmpty(raw.apartment),
        reference: this.nullIfEmpty(raw.reference)
      }
    };
  }

  private resetForm(): void {
    this.editingId = null;
    this.form.reset({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      documentType: 1,
      documentNumber: '',
      taxId: '',
      street: '',
      streetNumber: '',
      postalCode: '',
      city: '',
      stateOrProvince: '',
      country: 'Argentina',
      floor: '',
      apartment: '',
      reference: ''
    });
  }

  private resolveCustomerErrorMessage(err: unknown, fallback: string): string {
    const status = (err as HttpErrorResponse | undefined)?.status;
    if (status === 403 || status === 404) {
      return 'No tienes acceso a ese cliente para la empresa actual.';
    }

    return (err as any)?.error?.detail || (err as any)?.error?.message || fallback;
  }

  private loadCustomers(): void {
    this.customerService.listCustomers().subscribe({
      next: customers => {
        if (customers.length === 0) {
          this.customers = [];
          return;
        }

        forkJoin(
          customers.map(customer =>
            this.customerService.getCustomerById(customer.id).pipe(
              catchError(() => of(customer))
            )
          )
        ).subscribe({
          next: detailedCustomers => {
            this.customers = detailedCustomers;
          },
          error: () => {
            this.customers = customers;
          }
        });
      },
      error: err => {
        this.toast.error(this.resolveCustomerErrorMessage(err, 'No se pudieron cargar los clientes'));
      }
    });
  }

  formatAddress(customer: CustomerResponse): string {
    const address = customer.address;
    if (!address) {
      return 'Sin direccion';
    }

    const street = [address.street, address.streetNumber].filter(Boolean).join(' ').trim();
    const locality = [address.city, address.stateOrProvince].filter(Boolean).join(', ').trim();
    const postal = address.postalCode ? `CP ${address.postalCode}` : '';
    const country = address.country || '';
    return [street, locality, postal, country].filter(Boolean).join(' - ');
  }

  private nullIfEmpty(value: string | null | undefined): string | null {
    return value && value.trim().length > 0 ? value.trim() : null;
  }
}
