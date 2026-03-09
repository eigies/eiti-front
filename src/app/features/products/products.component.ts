import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { ProductService } from '../../core/services/product.service';
import { ProductResponse } from '../../core/models/product.models';
import { ToastService } from '../../shared/services/toast.service';
import { BranchService } from '../../core/services/branch.service';
import { BranchResponse } from '../../core/models/branch.models';
import { StockService } from '../../core/services/stock.service';
import { BranchProductStockResponse, StockMovementResponse } from '../../core/models/stock.models';
import { OnboardingService } from '../../core/services/onboarding.service';
import { OnboardingStatusResponse } from '../../core/models/onboarding.models';
import { OnboardingBannerComponent } from '../../shared/components/onboarding-banner/onboarding-banner.component';

type ProductModalMode = 'edit' | 'delete' | 'stock';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NavbarComponent, OnboardingBannerComponent],
  template: `
  <app-navbar></app-navbar>
  <div class="page" [class.page--guided-lock]="isOnboardingFocusLocked">
    <header class="page__header">
      <div class="page__eyebrow">_ PRODUCTOS</div>
      <h1 class="page__title">Catalogo activo</h1>
      <p class="page__sub">Crea productos, editalos desde el listado y manten el portfolio ordenado por compania.</p>
    </header>

    <app-onboarding-banner
      *ngIf="showProductOnboarding"
      [step]="4"
      [total]="5"
      [focused]="isOnboardingFocusLocked"
      title="Paso 4. Crea tu primer producto"
      text="Necesitas al menos un producto para registrar una venta. Lee este paso y presiona Entendido para habilitar el formulario."
      [actionLabel]="isOnboardingFocusLocked ? 'Entendido' : ''"
      (action)="acceptOnboardingStep()">
    </app-onboarding-banner>

    <app-onboarding-banner
      *ngIf="showStockOnboarding"
      [step]="5"
      [total]="5"
      [focused]="isOnboardingFocusLocked"
      title="Paso 5. Carga stock inicial"
      text="Con el producto creado, carga al menos una unidad de stock real desde el boton Stock para dejar la venta operativa."
      [actionLabel]="isOnboardingFocusLocked ? 'Entendido' : ''"
      (action)="acceptOnboardingStep()">
    </app-onboarding-banner>

    <section class="panel">
      <div class="panel__head">
        <span class="panel__icon">+</span>
        <span class="panel__title">Nuevo producto</span>
        <button class="panel__toggle" type="button" (click)="toggleCreatePanel()">
          {{ showCreatePanel ? 'Ocultar' : 'Mostrar' }}
        </button>
      </div>

      <form *ngIf="showCreatePanel" class="form-grid" [formGroup]="createForm" (ngSubmit)="create()" novalidate>
        <label class="field">
          <span class="field__label">Codigo</span>
          <input class="field__input" type="text" formControlName="code" placeholder="BAT-240" />
        </label>
        <label class="field">
          <span class="field__label">SKU</span>
          <input class="field__input" type="text" formControlName="sku" placeholder="MOURA-240-STD" />
        </label>
        <label class="field">
          <span class="field__label">Brand</span>
          <input class="field__input" type="text" formControlName="brand" placeholder="Acme" />
        </label>
        <label class="field">
          <span class="field__label">Nombre</span>
          <input class="field__input" type="text" formControlName="name" placeholder="Starter Suite" />
        </label>
        <label class="field field--wide">
          <span class="field__label">Descripcion</span>
          <textarea class="field__input field__input--area" formControlName="description" placeholder="Resumen breve del producto"></textarea>
        </label>
        <label class="field">
          <span class="field__label">Precio</span>
          <input class="field__input" type="number" min="0" step="0.01" formControlName="price" placeholder="0.00" />
        </label>
        <button class="btn-primary btn-primary--submit" type="submit" [disabled]="creating">
          {{ creating ? 'Guardando...' : 'Guardar producto ->' }}
        </button>
      </form>
    </section>

    <section class="panel panel--table">
      <div class="panel__head">
        <span class="panel__icon">#</span>
        <span class="panel__title">Listado</span>
        <span class="panel__count">{{ totalProducts }}</span>
        <button class="panel__toggle" type="button" (click)="toggleListPanel()">
          {{ showListPanel ? 'Ocultar' : 'Mostrar' }}
        </button>
      </div>

      <div class="loading-state" *ngIf="showListPanel && loading">Cargando productos...</div>
      <div class="empty-state" *ngIf="showListPanel && !loading && totalProducts === 0">Todavia no tenes productos cargados</div>

      <div class="table-wrap" *ngIf="showListPanel && !loading && totalProducts > 0">
        <table class="product-table">
          <thead>
            <tr>
              <th>Codigo</th><th>SKU</th><th>Brand</th><th>Producto</th><th>Descripcion</th>
              <th>Precio</th><th>Stock</th><th>Reservado</th><th>Disponible</th><th>Actualizado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let product of products; trackBy: trackByProduct">
              <td class="meta">{{ product.code }}</td>
              <td class="meta">{{ product.sku }}</td>
              <td class="brand">{{ product.brand }}</td>
              <td>{{ product.name }}</td>
              <td>{{ product.description || 'Sin descripcion' }}</td>
              <td class="meta">&#36;{{ product.price | number: '1.2-2' }}</td>
              <td class="meta">{{ product.totalOnHandQuantity }}</td>
              <td class="meta">{{ product.totalReservedQuantity }}</td>
              <td class="meta">{{ product.totalAvailableQuantity }}</td>
              <td>{{ (product.updatedAt || product.createdAt) | date: 'shortDate' }}</td>
              <td>
                <div class="action-stack">
                  <button class="btn-secondary btn-secondary--compact btn-secondary--stock" type="button" (click)="openStock(product)">Stock</button>
                  <button class="btn-secondary btn-secondary--compact btn-secondary--edit" type="button" (click)="openEditor(product)">Editar</button>
                  <button class="btn-danger btn-secondary--compact" type="button" (click)="openDelete(product)">Eliminar</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination" *ngIf="showListPanel && !loading && totalProducts > 0">
        <div class="pagination__summary">Mostrando {{ pageStart }}-{{ pageEnd }} de {{ totalProducts }}</div>
        <div class="pagination__actions">
          <label class="pagination__size">
            <span class="field__label">Items</span>
            <select class="field__input field__input--compact" [value]="pageSize" (change)="changePageSize($any($event.target).value)">
              <option *ngFor="let option of pageSizeOptions" [value]="option">{{ option }}</option>
            </select>
          </label>
          <button class="btn-secondary btn-secondary--compact" type="button" (click)="goToPage(currentPage - 1)" [disabled]="currentPage <= 1">Anterior</button>
          <span class="pagination__current">{{ currentPage }} / {{ totalPages }}</span>
          <button class="btn-secondary btn-secondary--compact" type="button" (click)="goToPage(currentPage + 1)" [disabled]="currentPage >= totalPages">Siguiente</button>
        </div>
      </div>
    </section>

    <div class="modal-backdrop" *ngIf="selectedProduct" (click)="closeModal()"></div>
    <section class="modal" *ngIf="selectedProduct">
      <div class="modal__panel" (click)="$event.stopPropagation()">
        <div class="panel__head panel__head--modal">
          <span class="panel__icon">{{ modalMode === 'edit' ? '~' : modalMode === 'delete' ? '!' : '#' }}</span>
          <span class="panel__title">{{ modalMode === 'edit' ? 'Editar producto' : modalMode === 'delete' ? 'Eliminar producto' : 'Stock por sucursal' }}</span>
          <button class="modal__close" type="button" (click)="closeModal()">x</button>
        </div>

        <p class="modal__notice" *ngIf="modalMode === 'delete'">
          Confirma la eliminacion. Si el producto ya fue usado en una venta, la API bloqueara el borrado.
        </p>

        <div *ngIf="modalMode === 'stock'" class="stock-modal">
          <label class="field">
            <span class="field__label">Sucursal</span>
            <select class="field__input" [value]="selectedStockBranchId" (change)="changeStockBranch($any($event.target).value)">
              <option value="">Seleccionar sucursal</option>
              <option *ngFor="let branch of branches" [value]="branch.id">{{ branch.name }}</option>
            </select>
          </label>

          <div class="stock-empty-state" *ngIf="!selectedStockBranchId">
            <strong>Selecciona una sucursal para continuar</strong>
            <span>Primero elige la sucursal donde quieres consultar o cargar stock. Hasta entonces, el formulario queda bloqueado.</span>
          </div>

          <div class="stock-summary" *ngIf="selectedBranchStock">
            <div class="stock-summary__item"><span class="field__label">Stock</span><strong>{{ selectedBranchStock.onHandQuantity }}</strong></div>
            <div class="stock-summary__item"><span class="field__label">Reservado</span><strong>{{ selectedBranchStock.reservedQuantity }}</strong></div>
            <div class="stock-summary__item"><span class="field__label">Disponible</span><strong>{{ selectedBranchStock.availableQuantity }}</strong></div>
          </div>

          <fieldset class="stock-form-shell" [disabled]="!selectedStockBranchId">
            <form class="stock-form" [formGroup]="stockForm" (ngSubmit)="submitStock()" novalidate>
              <label class="field">
                <span class="field__label">Movimiento</span>
                <select class="field__input" formControlName="type">
                  <option [ngValue]="1">Ingreso manual</option>
                  <option [ngValue]="2">Ajuste manual</option>
                </select>
              </label>
              <label class="field">
                <span class="field__label">Cantidad</span>
                <input class="field__input" type="number" formControlName="quantity" />
              </label>
              <label class="field field--wide">
                <span class="field__label">Descripcion</span>
                <input class="field__input" type="text" formControlName="description" placeholder="Motivo del movimiento" />
              </label>
              <div class="modal__actions">
                <button class="btn-secondary" type="button" (click)="closeModal()">Cerrar</button>
                <button class="btn-primary" type="submit" [disabled]="stockSaving || !selectedStockBranchId">
                  {{ stockSaving ? 'Guardando...' : 'Guardar stock' }}
                </button>
              </div>
            </form>
          </fieldset>

          <div class="stock-history" *ngIf="stockMovements.length > 0">
            <div class="stock-history__title">Movimientos</div>
            <div class="stock-history__list">
              <div class="stock-history__row" *ngFor="let movement of stockMovements">
                <div>
                  <strong>{{ stockMovementLabel(movement.type) }}</strong>
                  <span>{{ movement.description || 'Sin descripcion' }}</span>
                </div>
                <div>
                  <strong>{{ movement.quantity }}</strong>
                  <span>{{ movement.createdAt | date: 'short' }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="loading-state" *ngIf="selectedStockBranchId && !stockLoading && stockMovements.length === 0">
            Todavia no hay movimientos para este producto en la sucursal seleccionada.
          </div>
        </div>

        <form *ngIf="modalMode !== 'stock'" [formGroup]="editForm" (ngSubmit)="submitModal()" novalidate>
          <label class="field"><span class="field__label">Codigo</span><input class="field__input" type="text" formControlName="code" [readonly]="modalMode === 'delete'" /></label>
          <label class="field"><span class="field__label">SKU</span><input class="field__input" type="text" formControlName="sku" [readonly]="modalMode === 'delete'" /></label>
          <label class="field"><span class="field__label">Brand</span><input class="field__input" type="text" formControlName="brand" [readonly]="modalMode === 'delete'" /></label>
          <label class="field"><span class="field__label">Nombre</span><input class="field__input" type="text" formControlName="name" [readonly]="modalMode === 'delete'" /></label>
          <label class="field"><span class="field__label">Descripcion</span><textarea class="field__input field__input--area" formControlName="description" [readonly]="modalMode === 'delete'"></textarea></label>
          <label class="field"><span class="field__label">Precio</span><input class="field__input" type="number" min="0" step="0.01" formControlName="price" [readonly]="modalMode === 'delete'" /></label>
          <div class="modal__actions">
            <button class="btn-secondary" type="button" (click)="closeModal()">Cancelar</button>
            <button class="btn-danger" *ngIf="modalMode === 'delete'" type="submit" [disabled]="deleting">{{ deleting ? 'Eliminando...' : 'Confirmar eliminacion' }}</button>
            <button class="btn-primary" *ngIf="modalMode === 'edit'" type="submit" [disabled]="updating">{{ updating ? 'Actualizando...' : 'Guardar cambios' }}</button>
          </div>
        </form>
      </div>
    </section>
  </div>
  `,
  styles: [`
    .page{min-height:calc(100vh - 64px);background:radial-gradient(circle at top right,var(--page-radial),transparent 32%),linear-gradient(180deg,var(--bg) 0%,var(--bg-elevated) 100%);padding:3rem 2rem;max-width:1180px;margin:0 auto;position:relative}
    .page--guided-lock .panel{opacity:.34;pointer-events:none;filter:saturate(.7)}
    .page__header{margin-bottom:2rem}.page__eyebrow,.field__label,.panel__title,.product-table th{font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.16em;text-transform:uppercase}
    .page__eyebrow{color:var(--amber);margin-bottom:.6rem}.page__title{margin:0;color:var(--text);font-family:'DM Mono',monospace;font-size:clamp(2rem,4vw,3rem)}.page__sub{margin:.75rem 0 0;color:var(--text-soft);font-family:'Crimson Pro',serif;font-size:1rem;max-width:48rem}
    .panel{background:color-mix(in srgb,var(--bg-panel) 94%,transparent);border:1px solid var(--border);border-radius:4px;padding:1.6rem;margin-bottom:1.4rem;position:relative;overflow:hidden}
    .panel::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,color-mix(in srgb,var(--amber) 8%,transparent),transparent 46%);pointer-events:none}
    .panel__head{position:relative;display:flex;align-items:center;gap:.6rem;margin-bottom:1.25rem;padding-bottom:.9rem;border-bottom:1px solid var(--border)}.panel__head--modal{margin-bottom:1rem}
    .panel__icon{width:1.4rem;height:1.4rem;display:inline-flex;align-items:center;justify-content:center;color:var(--amber);border:1px solid color-mix(in srgb,var(--amber) 18%,transparent);background:color-mix(in srgb,var(--amber) 8%,transparent);font-family:'DM Mono',monospace;font-size:.8rem}
    .panel__title{color:var(--text-dim);flex:1}.panel__count{color:var(--amber);font-family:'DM Mono',monospace;font-size:.8rem}
    .panel__toggle{border:1px solid var(--border-2);background:transparent;color:var(--text-dim);padding:.55rem .8rem;border-radius:2px;cursor:pointer;font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}
    .form-grid{position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem;align-items:start}.field{position:relative;display:block}.field--wide{grid-column:span 3}
    .field__label{display:block;margin-bottom:.45rem;color:var(--text-dim)}.field__input{width:100%;box-sizing:border-box;border:1px solid var(--border-2);background:var(--bg);color:var(--text);padding:.75rem .9rem;font-family:'DM Mono',monospace;font-size:.86rem;border-radius:2px;outline:none}
    .field__input:focus{border-color:var(--amber);box-shadow:0 0 0 3px var(--surface-glow)}.field__input[readonly]{background:var(--bg-soft);color:var(--text-dim);cursor:not-allowed}.field__input--area{min-height:88px;resize:vertical}.field__input--compact{padding:.55rem .75rem;font-size:.76rem}
    .btn-primary,.btn-secondary,.btn-danger{border-radius:2px;padding:.85rem 1.1rem;font-family:'DM Mono',monospace;font-size:.78rem;text-transform:uppercase;letter-spacing:.14em;cursor:pointer}
    .btn-primary{border:none;background:var(--amber);color:var(--bg)}.btn-primary--submit{align-self:end}.btn-primary:disabled,.btn-secondary:disabled,.btn-danger:disabled{opacity:.55;cursor:not-allowed}
    .btn-secondary{background:transparent;color:var(--text-dim);border:1px solid var(--border-2)}.btn-secondary--edit{color:var(--amber);border-color:color-mix(in srgb,var(--amber) 34%,var(--border-2));background:color-mix(in srgb,var(--amber) 6%,transparent)}.btn-secondary--stock{color:var(--success);border-color:color-mix(in srgb,var(--success) 34%,var(--border-2));background:color-mix(in srgb,var(--success) 6%,transparent)}
    .btn-secondary--compact,.btn-danger{padding:.55rem .75rem;font-size:.66rem}.btn-danger{border:1px solid color-mix(in srgb,var(--danger) 45%,var(--border-2));background:transparent;color:var(--danger)}
    .table-wrap{overflow-x:auto;position:relative}.product-table{width:100%;border-collapse:collapse;min-width:900px}.product-table th{color:var(--text-subtle);text-align:left;padding:0 .8rem .8rem 0;border-bottom:1px solid var(--border)}
    .product-table td{padding:.95rem .8rem .95rem 0;color:var(--text);border-bottom:1px solid color-mix(in srgb,var(--border) 65%,transparent);font-family:'Crimson Pro',serif;font-size:.96rem;vertical-align:top}.product-table tbody tr:hover{background:color-mix(in srgb,var(--amber) 4%,transparent)}
    .pagination{position:relative;display:flex;justify-content:space-between;gap:1rem;align-items:center;margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)}
    .pagination__summary,.pagination__current{font-family:'DM Mono',monospace;font-size:.72rem;color:var(--text-dim)}
    .pagination__actions{display:flex;align-items:flex-end;gap:.75rem;flex-wrap:wrap}
    .pagination__size{display:grid;gap:.35rem;min-width:5.5rem}
    .meta,.brand{font-family:'DM Mono',monospace;font-size:.8rem}.meta{color:var(--text-dim)}.brand{color:var(--amber)}.action-stack{display:grid;gap:.45rem;min-width:9rem}
    .loading-state,.empty-state{padding:2.5rem 1rem;text-align:center;border:1px dashed var(--border);color:var(--text-soft);font-family:'DM Mono',monospace;font-size:.78rem}
    .modal-backdrop{position:fixed;inset:0;background:var(--overlay);backdrop-filter:blur(4px);z-index:30}.modal{position:fixed;inset:0;display:grid;place-items:center;z-index:31;padding:1rem}
    .modal__panel{width:min(100%,540px);background:var(--bg-panel);border:1px solid var(--border-2);border-radius:4px;padding:1.4rem;box-shadow:0 18px 60px rgba(0,0,0,.25)}.modal__close{width:2rem;height:2rem;border:1px solid var(--border-2);background:transparent;color:var(--text-dim);cursor:pointer;font-family:'DM Mono',monospace}
    .modal__notice{margin-bottom:1rem;padding:.8rem .95rem;border:1px solid color-mix(in srgb,var(--danger) 20%,var(--border));background:color-mix(in srgb,var(--danger) 6%,transparent);color:var(--text-soft);font-family:'Crimson Pro',serif;font-size:.96rem}
    .modal__actions{display:flex;justify-content:flex-end;gap:.75rem;margin-top:1rem}.stock-modal{display:grid;gap:1rem}
    .stock-empty-state{display:grid;gap:.35rem;padding:.8rem .95rem;border:1px dashed color-mix(in srgb,var(--amber) 28%,var(--border));background:color-mix(in srgb,var(--amber) 5%,transparent);color:var(--text-soft);font-family:'DM Mono',monospace;font-size:.72rem;line-height:1.5}
    .stock-empty-state strong{color:var(--amber);font-size:.74rem;letter-spacing:.08em;text-transform:uppercase}.stock-form-shell{margin:0;padding:0;border:none;min-width:0}.stock-form-shell:disabled{opacity:.52;filter:saturate(.7)}
    .stock-form,.stock-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.stock-summary{grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem}
    .stock-summary__item{border:1px solid var(--border);background:color-mix(in srgb,var(--amber) 4%,transparent);padding:.75rem .9rem;display:grid;gap:.3rem}.stock-summary__item strong{font-family:'DM Mono',monospace;color:var(--text);font-size:1rem}
    .stock-history{display:grid;gap:.6rem}.stock-history__title{font-family:'DM Mono',monospace;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--text-dim)}
    .stock-history__list{display:grid;gap:.55rem;max-height:220px;overflow:auto}.stock-history__row{display:flex;justify-content:space-between;gap:1rem;padding:.7rem .8rem;border:1px solid var(--border);background:var(--bg)}
    .stock-history__row div{display:grid;gap:.2rem}.stock-history__row strong,.stock-history__row span{font-family:'DM Mono',monospace;font-size:.72rem}.stock-history__row span{color:var(--text-dim)}
    @media (max-width:860px){.form-grid{grid-template-columns:1fr}.field--wide{grid-column:auto}.stock-form,.stock-summary{grid-template-columns:1fr}.pagination{display:grid;align-items:stretch}.pagination__actions{align-items:stretch}}
  `]
})
export class ProductsComponent implements OnInit {
  createForm: FormGroup;
  editForm: FormGroup;
  stockForm: FormGroup;
  products: ProductResponse[] = [];
  branches: BranchResponse[] = [];
  readonly pageSizeOptions = [10, 25, 50];
  loading = false;
  creating = false;
  updating = false;
  deleting = false;
  stockSaving = false;
  stockLoading = false;
  showCreatePanel = true;
  showListPanel = true;
  currentPage = 1;
  pageSize = 10;
  totalProducts = 0;
  totalPages = 1;
  selectedProduct: ProductResponse | null = null;
  modalMode: ProductModalMode = 'edit';
  onboardingStatus: OnboardingStatusResponse | null = null;
  selectedStockBranchId = '';
  selectedBranchStock: BranchProductStockResponse | null = null;
  stockMovements: StockMovementResponse[] = [];

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private branchService: BranchService,
    private stockService: StockService,
    private toast: ToastService,
    private onboardingService: OnboardingService,
    private router: Router
  ) {
    this.createForm = this.buildForm();
    this.editForm = this.buildForm();
    this.stockForm = this.fb.group({
      type: [1, Validators.required],
      quantity: [1, Validators.required],
      description: ['']
    });
  }

  ngOnInit(): void {
    this.refreshOnboarding();
    this.loadBranches();
    this.loadProducts();
  }

  get showProductOnboarding(): boolean {
    return !!this.onboardingStatus && !this.onboardingStatus.isCompleted && this.onboardingStatus.nextStep === 'Product';
  }

  get showStockOnboarding(): boolean {
    return !!this.onboardingStatus && !this.onboardingStatus.isCompleted && this.onboardingStatus.nextStep === 'Stock';
  }

  get isOnboardingFocusLocked(): boolean {
    const step = this.currentOnboardingStep;
    return !!step && !this.onboardingService.isStepAccepted(step);
  }

  isInvalid(form: FormGroup, field: string): boolean {
    const control = form.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  get pageStart(): number {
    if (this.totalProducts === 0) {
      return 0;
    }

    return ((this.currentPage - 1) * this.pageSize) + 1;
  }

  get pageEnd(): number {
    if (this.totalProducts === 0) {
      return 0;
    }

    return Math.min(this.currentPage * this.pageSize, this.totalProducts);
  }

  create(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.creating = true;
    this.productService.createProduct(this.createForm.getRawValue()).subscribe({
      next: (product) => {
        this.createForm.reset({ code: '', sku: '', brand: '', name: '', description: '', price: 0 });
        this.toast.success(`Producto "${product.name}" creado correctamente`);
        this.creating = false;
        this.currentPage = 1;
        this.loadProducts();
        this.refreshOnboarding(true);
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'Error al crear el producto');
        this.creating = false;
      }
    });
  }

  openEditor(product: ProductResponse): void {
    this.modalMode = 'edit';
    this.openModal(product);
  }

  openDelete(product: ProductResponse): void {
    this.modalMode = 'delete';
    this.openModal(product);
  }

  openStock(product: ProductResponse): void {
    this.modalMode = 'stock';
    this.selectedProduct = product;
    this.stockForm.reset({ type: 1, quantity: 1, description: '' });
    this.stockMovements = [];
    this.selectedBranchStock = null;
    this.selectedStockBranchId = '';
  }

  closeModal(): void {
    if (this.updating || this.deleting || this.stockSaving) {
      return;
    }
    this.selectedProduct = null;
    this.selectedStockBranchId = '';
    this.selectedBranchStock = null;
    this.stockMovements = [];
  }

  submitModal(): void {
    if (this.modalMode === 'delete') {
      this.remove();
      return;
    }
    this.update();
  }

  changeStockBranch(branchId: string): void {
    this.selectedStockBranchId = branchId;
    this.selectedBranchStock = null;
    this.stockMovements = [];

    if (!this.selectedProduct || !branchId) {
      return;
    }

    this.stockLoading = true;
    this.stockService.getBranchProductStock(branchId, this.selectedProduct.id).subscribe({
      next: stock => {
        this.selectedBranchStock = stock;
        this.stockLoading = false;
      },
      error: err => {
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo cargar el stock de la sucursal');
        this.stockLoading = false;
      }
    });

    this.stockService.listStockMovements(branchId, this.selectedProduct.id).subscribe({
      next: movements => this.stockMovements = movements,
      error: () => this.stockMovements = []
    });
  }

  submitStock(): void {
    if (!this.selectedProduct || !this.selectedStockBranchId) {
      this.toast.error('Selecciona una sucursal para ajustar stock.');
      return;
    }

    if (this.stockForm.invalid) {
      this.stockForm.markAllAsTouched();
      return;
    }

    const raw = this.stockForm.getRawValue();
    this.stockSaving = true;
    this.stockService.adjustStock({
      branchId: this.selectedStockBranchId,
      productId: this.selectedProduct.id,
      quantity: Number(raw.quantity ?? 0),
      type: Number(raw.type ?? 1),
      description: raw.description || null
    }).subscribe({
      next: stock => {
        this.selectedBranchStock = stock;
        this.stockSaving = false;
        this.stockForm.patchValue({ quantity: 1, description: '' });
        this.toast.success('Stock actualizado');
        this.changeStockBranch(this.selectedStockBranchId);
        this.loadProducts();
        this.refreshOnboarding(true);
      },
      error: err => {
        this.stockSaving = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo actualizar el stock');
      }
    });
  }

  update(): void {
    if (!this.selectedProduct) {
      return;
    }

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.updating = true;
    this.productService.updateProduct(this.selectedProduct.id, this.editForm.getRawValue()).subscribe({
      next: (updated) => {
        this.products = this.products.map(product => product.id === updated.id ? updated : product);
        this.toast.success(`Producto "${updated.name}" actualizado`);
        this.updating = false;
        this.selectedProduct = null;
      },
      error: (err) => {
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo actualizar el producto');
        this.updating = false;
      }
    });
  }

  remove(): void {
    if (!this.selectedProduct) {
      return;
    }

    this.deleting = true;
    this.productService.deleteProduct(this.selectedProduct.id).subscribe({
      next: () => {
        this.toast.success(`Producto "${this.selectedProduct?.name}" eliminado`);
        this.deleting = false;
        this.selectedProduct = null;
        this.loadProducts();
      },
      error: (err) => {
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo eliminar el producto');
        this.deleting = false;
      }
    });
  }

  trackByProduct(_: number, product: ProductResponse): string {
    return product.id;
  }

  toggleCreatePanel(): void {
    this.showCreatePanel = !this.showCreatePanel;
  }

  toggleListPanel(): void {
    this.showListPanel = !this.showListPanel;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }

    this.currentPage = page;
    this.loadProducts();
  }

  changePageSize(rawPageSize: string): void {
    const parsedPageSize = Number(rawPageSize);

    if (!Number.isFinite(parsedPageSize) || parsedPageSize <= 0 || parsedPageSize === this.pageSize) {
      return;
    }

    this.pageSize = parsedPageSize;
    this.currentPage = 1;
    this.loadProducts();
  }

  stockMovementLabel(type: number): string {
    switch (type) {
      case 1: return 'Ingreso manual';
      case 2: return 'Ajuste manual';
      case 3: return 'Reserva';
      case 4: return 'Liberacion';
      case 5: return 'Salida';
      default: return 'Movimiento';
    }
  }

  acceptOnboardingStep(): void {
    const step = this.currentOnboardingStep;
    if (step) {
      this.onboardingService.acceptStep(step);
    }
  }

  private loadProducts(): void {
    this.loading = true;
    this.productService.listProductsPaged(this.currentPage, this.pageSize).subscribe({
      next: (response) => {
        this.products = response.items;
        this.currentPage = response.page;
        this.pageSize = response.pageSize;
        this.totalProducts = response.totalCount;
        this.totalPages = response.totalPages;
        this.loading = false;
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'No se pudieron cargar los productos');
        this.products = [];
        this.totalProducts = 0;
        this.totalPages = 1;
        this.loading = false;
      }
    });
  }

  private loadBranches(): void {
    this.branchService.listBranches().subscribe({
      next: branches => this.branches = branches,
      error: () => this.branches = []
    });
  }

  private openModal(product: ProductResponse): void {
    this.selectedProduct = product;
    this.editForm.reset({
      code: product.code,
      sku: product.sku,
      brand: product.brand,
      name: product.name,
      description: product.description ?? '',
      price: product.price
    });
  }

  private buildForm(): FormGroup {
    return this.fb.group({
      code: ['', [Validators.required, Validators.maxLength(50)]],
      sku: ['', [Validators.required, Validators.maxLength(80)]],
      brand: ['', [Validators.required, Validators.maxLength(100)]],
      name: ['', [Validators.required, Validators.maxLength(150)]],
      description: ['', [Validators.maxLength(1000)]],
      price: [0, [Validators.required, Validators.min(0)]]
    });
  }

  private refreshOnboarding(force = false): void {
    this.onboardingService.fetchStatus(force).subscribe({
      next: status => {
        this.onboardingStatus = status;

        if (force && status.isCompleted) {
          this.router.navigate(['/sales']);
          return;
        }

        const nextRoute = this.onboardingService.routeForStep(status.nextStep);
        if (!status.isCompleted && nextRoute && nextRoute !== '/products') {
          this.router.navigate([nextRoute]);
        }
      }
    });
  }

  private get currentOnboardingStep(): 'Product' | 'Stock' | null {
    if (this.showProductOnboarding) return 'Product';
    if (this.showStockOnboarding) return 'Stock';
    return null;
  }
}
