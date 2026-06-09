import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductCategoryService } from '../../core/services/product-category.service';
import { ProductCategoryResponse } from '../../core/models/product-category.models';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';

@Component({
  selector: 'app-product-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './product-categories.component.html',
  styleUrls: ['./product-categories.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductCategoriesComponent implements OnInit {
  categories: ProductCategoryResponse[] = [];
  loading = true;
  saving = false;
  deleting: string | null = null;
  showModal = false;
  editingCategory: ProductCategoryResponse | null = null;
  searchQuery = '';

  form: FormGroup;

  constructor(
    private readonly categoryService: ProductCategoryService,
    private readonly toast: ToastService,
    private readonly fb: FormBuilder,
    private readonly cdr: ChangeDetectorRef,
    private readonly confirmation: ConfirmationService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]]
    });
  }

  ngOnInit(): void {
    this.load();
  }

  get filteredCategories(): ProductCategoryResponse[] {
    if (!this.searchQuery.trim()) return this.categories;
    const q = this.searchQuery.toLowerCase();
    return this.categories.filter(c => c.name.toLowerCase().includes(q));
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  openCreate(): void {
    this.editingCategory = null;
    this.form.reset({ name: '' });
    this.showModal = true;
  }

  openEdit(category: ProductCategoryResponse): void {
    this.editingCategory = category;
    this.form.reset({ name: category.name });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingCategory = null;
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const name = String(this.form.getRawValue().name).trim();

    if (this.editingCategory) {
      this.categoryService.update(this.editingCategory.id, { id: this.editingCategory.id, name }).subscribe({
        next: () => {
          this.toast.success('Categoría actualizada');
          this.saving = false;
          this.closeModal();
          this.load();
        },
        error: (err: { error?: { detail?: string } }) => {
          this.toast.error(err?.error?.detail || 'Error al actualizar la categoría');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
    } else {
      this.categoryService.create({ name }).subscribe({
        next: (res) => {
          this.toast.success(`Categoría "${res.name}" creada`);
          this.saving = false;
          this.closeModal();
          this.load();
        },
        error: (err: { error?: { detail?: string } }) => {
          this.toast.error(err?.error?.detail || 'Error al crear la categoría');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
    }
  }

  async confirmDelete(category: ProductCategoryResponse): Promise<void> {
    const confirmed = await this.confirmation.confirm({
      eyebrow: 'Categorías de producto',
      title: 'Eliminar categoría',
      message: `Vas a eliminar la categoría "${category.name}".`,
      detail: 'Los productos que la tengan asignada quedarán "Sin categoría". Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar categoría',
      tone: 'danger'
    });
    if (!confirmed) return;
    this.deleting = category.id;
    this.categoryService.delete(category.id).subscribe({
      next: () => {
        this.toast.success('Categoría eliminada');
        this.deleting = null;
        this.load();
      },
      error: (err: { error?: { detail?: string } }) => {
        this.toast.error(err?.error?.detail || 'Error al eliminar la categoría');
        this.deleting = null;
        this.cdr.markForCheck();
      }
    });
  }

  private load(): void {
    this.loading = true;
    this.categoryService.list().subscribe({
      next: categories => {
        this.categories = categories;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('No se pudieron cargar las categorías');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }
}
