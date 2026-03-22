import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { CustomerService } from '../../core/services/customer.service';
import { CustomerResponse } from '../../core/models/customer.models';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.css']
})
export class CustomersComponent implements OnInit {
  form: FormGroup;
  customers: CustomerResponse[] = [];
  creating = false;
  readonly documentTypes = [
    { value: 1, label: 'DNI' },
    { value: 2, label: 'Pasaporte' },
    { value: 3, label: 'LE' },
    { value: 4, label: 'LC' },
    { value: 5, label: 'Otro' }
  ];

  constructor(
    private fb: FormBuilder,
    private customerService: CustomerService,
    private toast: ToastService
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

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  create(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.creating = true;
    const raw = this.form.getRawValue();
    this.customerService.createCustomer({
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
    }).subscribe({
      next: (c) => {
        this.customers.unshift(c);
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
        this.toast.success(`Cliente "${c.name}" creado correctamente`);
        this.creating = false;
        this.loadCustomers();
      },
      error: (err) => {
        const msg = this.resolveCustomerErrorMessage(err, 'Error al crear el cliente');
        this.toast.error(msg);
        this.creating = false;
      }
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
    return [street, locality, postal, country].filter(Boolean).join(' · ');
  }

  private nullIfEmpty(value: string | null | undefined): string | null {
    return value && value.trim().length > 0 ? value.trim() : null;
  }
}
