import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupplierService } from '../../core/services/supplier.service';
import { SupplierListItem, UpdateSupplierRequest } from '../../core/models/supplier.models';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './suppliers.component.html',
  styleUrls: ['./suppliers.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SuppliersComponent implements OnInit {
  suppliers: SupplierListItem[] = [];
  loading = true;
  saving = false;
  deactivating: string | null = null;
  showModal = false;
  editingSupplier: SupplierListItem | null = null;
  searchQuery = '';

  form: FormGroup;

  constructor(
    private readonly supplierService: SupplierService,
    private readonly toast: ToastService,
    private readonly fb: FormBuilder,
    private readonly cdr: ChangeDetectorRef,
    private readonly confirmation: ConfirmationService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      taxId: [''],
      phone: [''],
      email: ['', [Validators.email]],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.load();
  }

  get filteredSuppliers(): SupplierListItem[] {
    if (!this.searchQuery.trim()) return this.suppliers;
    const q = this.searchQuery.toLowerCase();
    return this.suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.taxId?.toLowerCase().includes(q) ?? false) ||
      (s.email?.toLowerCase().includes(q) ?? false)
    );
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  openCreate(): void {
    this.editingSupplier = null;
    this.form.reset({ name: '', taxId: '', phone: '', email: '', notes: '' });
    this.showModal = true;
  }

  openEdit(supplier: SupplierListItem): void {
    this.editingSupplier = supplier;
    this.form.reset({
      name: supplier.name,
      taxId: supplier.taxId ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      notes: ''
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingSupplier = null;
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const raw = this.form.getRawValue();
    const req = {
      name: raw.name.trim(),
      taxId: this.nullIfEmpty(raw.taxId),
      phone: this.nullIfEmpty(raw.phone),
      email: this.nullIfEmpty(raw.email),
      notes: this.nullIfEmpty(raw.notes)
    };

    if (this.editingSupplier) {
      const updateReq: UpdateSupplierRequest = { ...req, id: this.editingSupplier.id };
      this.supplierService.updateSupplier(this.editingSupplier.id, updateReq).subscribe({
        next: () => {
          this.toast.success('Proveedor actualizado');
          this.saving = false;
          this.closeModal();
          this.load();
        },
        error: (err: { error?: { detail?: string } }) => {
          this.toast.error(err?.error?.detail || 'Error al actualizar el proveedor');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
    } else {
      this.supplierService.createSupplier(req).subscribe({
        next: (res) => {
          this.toast.success(`Proveedor "${res.name}" creado`);
          this.saving = false;
          this.closeModal();
          this.load();
        },
        error: (err: { error?: { detail?: string } }) => {
          this.toast.error(err?.error?.detail || 'Error al crear el proveedor');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
    }
  }

  async confirmDeactivate(supplier: SupplierListItem): Promise<void> {
    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Gestion de proveedores',
      title: 'Desactivar proveedor',
      message: `Vas a desactivar al proveedor "${supplier.name}".`,
      detail: 'Podra ser reactivado mas adelante por un administrador.',
      confirmLabel: 'Desactivar',
      tone: 'warning'
    });
    if (!confirmed) return;
    this.deactivating = supplier.id;
    this.supplierService.deactivateSupplier(supplier.id).subscribe({
      next: () => {
        this.toast.success('Proveedor desactivado');
        this.deactivating = null;
        this.load();
      },
      error: (err: { error?: { detail?: string } }) => {
        this.toast.error(err?.error?.detail || 'Error al desactivar el proveedor');
        this.deactivating = null;
        this.cdr.markForCheck();
      }
    });
  }

  private load(): void {
    this.loading = true;
    this.supplierService.listSuppliers(undefined, false).subscribe({
      next: suppliers => {
        this.suppliers = suppliers;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('No se pudieron cargar los proveedores');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private nullIfEmpty(value: string | null | undefined): string | null {
    return value && value.trim().length > 0 ? value.trim() : null;
  }
}
