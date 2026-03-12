import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { ProductService } from '../../core/services/product.service';
import { ProductResponse, productAllowsManualSaleValue, productPublicPrice } from '../../core/models/product.models';
import { ToastService } from '../../shared/services/toast.service';
import { BranchService } from '../../core/services/branch.service';
import { BranchResponse } from '../../core/models/branch.models';
import { StockService } from '../../core/services/stock.service';
import { BranchProductStockResponse, StockMovementResponse } from '../../core/models/stock.models';
import { OnboardingService } from '../../core/services/onboarding.service';
import { OnboardingStatusResponse } from '../../core/models/onboarding.models';
import { OnboardingBannerComponent } from '../../shared/components/onboarding-banner/onboarding-banner.component';
import { AuthService } from '../../core/services/auth.service';
import { forkJoin } from 'rxjs';

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
        <div class="field field--price-mode">
          <span class="field__label">Modo de precio</span>
          <div class="toggle-cluster">
            <label class="toggle-check">
              <input type="radio" name="createPriceMode" [checked]="createPriceMode === 'public'" (change)="setCreatePriceMode('public')" />
              <span class="toggle-check__track"></span>
              <span class="toggle-check__text">Precio publico</span>
            </label>
            <label class="toggle-check" *ngIf="canViewCostPrice">
              <input type="radio" name="createPriceMode" [checked]="createPriceMode === 'margin'" (change)="setCreatePriceMode('margin')" [disabled]="createForm.get('allowsManualSaleValue')?.value" />
              <span class="toggle-check__track"></span>
              <span class="toggle-check__text">Margen de ganancia</span>
            </label>
          </div>
        </div>
        <div class="field field--toggle-note">
          <span class="field__label">Uso en venta</span>
          <label class="toggle-check toggle-check--special">
            <input type="checkbox" formControlName="allowsManualSaleValue" (change)="toggleManualSaleValue(createForm, createPriceMode, $any($event.target).checked, 'create')" />
            <span class="toggle-check__track"></span>
            <span class="toggle-check__text">Producto para parte de pago / canje</span>
          </label>
          <small class="field__hint" *ngIf="createForm.get('allowsManualSaleValue')?.value">Se guarda con precio publico 0 y el valor se define al momento de la venta.</small>
        </div>
        <label class="field field--price-primary">
          <span class="field__label">{{ createPriceMode === 'margin' ? 'Margen %' : 'Precio publico' }}</span>
          <input *ngIf="createPriceMode === 'public'" class="field__input" type="number" min="0" step="0.01" formControlName="publicPrice" placeholder="0.00" />
          <input *ngIf="createPriceMode === 'margin'" class="field__input" type="number" min="0" step="0.01" formControlName="marginPercent" placeholder="35" (input)="syncPriceFromMargin(createForm, createPriceMode)" />
        </label>
        <label class="field" *ngIf="canViewCostPrice">
          <span class="field__label">Precio costo</span>
          <input class="field__input" type="number" min="0" step="0.01" formControlName="costPrice" placeholder="0.00" (input)="syncPriceFromMargin(createForm, createPriceMode)" />
        </label>
        <label class="field">
          <span class="field__label">Precio unitario</span>
          <input class="field__input" type="number" min="0" step="0.01" formControlName="unitPrice" placeholder="Opcional para packs" />
        </label>
        <div class="price-preview-card">
          <span class="field__label">Radar comercial</span>
          <strong>{{ createForm.get('allowsManualSaleValue')?.value ? 'Valor definido en venta' : (publicPricePreview(createForm) | currency:'USD':'symbol':'1.2-2') }}</strong>
          <small *ngIf="createForm.get('allowsManualSaleValue')?.value">Este producto no vale 0 realmente: se identifica asi para que el importe se cargue manualmente en la venta.</small>
          <small *ngIf="canViewCostPrice">Costo {{ costPricePreview(createForm) | currency:'USD':'symbol':'1.2-2' }} · Margen {{ marginPreview(createForm) | number:'1.0-0' }}%</small>
          <small *ngIf="!canViewCostPrice && !createForm.get('allowsManualSaleValue')?.value">Precio visible para venta y catalogo.</small>
        </div>
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

      <div class="bulk-edit-bar" *ngIf="showListPanel && !loading && totalProducts > 0">
        <div class="bulk-edit-bar__copy">
          <span class="bulk-edit-bar__eyebrow">Edicion</span>
          <strong>{{ bulkEditMode ? 'Modo edicion masiva activo' : 'Listado en modo consulta' }}</strong>
          <small *ngIf="!bulkEditMode">Activa la edicion inline para corregir varios productos seguidos sin abrir y cerrar el modal.</small>
          <small *ngIf="bulkEditMode">
            {{ modifiedProductsCount }} producto(s) modificado(s)
            <span *ngIf="invalidBulkRowsCount > 0">· {{ invalidBulkRowsCount }} fila(s) con errores</span>
          </small>
        </div>
        <div class="bulk-edit-bar__actions" *ngIf="!bulkEditMode">
          <button class="btn-secondary btn-secondary--edit-mode" type="button" (click)="enterBulkEditMode()">Editar varios</button>
        </div>
        <div class="bulk-edit-bar__actions" *ngIf="bulkEditMode">
          <span class="bulk-edit-badge" *ngIf="modifiedProductsCount > 0">{{ modifiedProductsCount }} cambio(s)</span>
          <button class="btn-secondary" type="button" (click)="cancelBulkEdit()">Cancelar</button>
          <button class="btn-primary" type="button" (click)="saveBulkChanges()" [disabled]="bulkEditSaving || modifiedProductsCount === 0 || invalidBulkRowsCount > 0">
            {{ bulkEditSaving ? 'Guardando...' : 'Confirmar cambios' }}
          </button>
        </div>
      </div>

      <div class="table-wrap" *ngIf="showListPanel && !loading && totalProducts > 0">
        <table class="product-table">
          <thead>
            <tr>
              <th>Codigo</th><th>SKU</th><th>Tipo</th><th>Brand</th><th>Producto</th><th>Descripcion</th>
              <th>Precio publico</th><th *ngIf="canViewCostPrice">Costo</th><th>Unitario</th><th>Stock</th><th>Reservado</th><th>Disponible</th><th>Actualizado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let product of products; trackBy: trackByProduct"
                [formGroup]="bulkForm(product.id)"
                [class.product-row--bulk]="bulkEditMode"
                [class.product-row--changed]="isBulkProductModified(product.id)"
                [class.product-row--invalid]="bulkEditMode && bulkForm(product.id).invalid">
              <td class="meta" [class.cell--changed]="isBulkFieldChanged(product.id, 'code')" [class.cell--invalid]="isBulkFieldInvalid(product.id, 'code')">
                <ng-container *ngIf="bulkEditMode; else readCode">
                  <input class="field__input field__input--table" type="text" formControlName="code" />
                </ng-container>
                <ng-template #readCode>{{ product.code }}</ng-template>
              </td>
              <td class="meta" [class.cell--changed]="isBulkFieldChanged(product.id, 'sku')" [class.cell--invalid]="isBulkFieldInvalid(product.id, 'sku')">
                <ng-container *ngIf="bulkEditMode; else readSku">
                  <input class="field__input field__input--table" type="text" formControlName="sku" />
                </ng-container>
                <ng-template #readSku>{{ product.sku }}</ng-template>
              </td>
              <td [class.cell--changed]="isBulkFieldChanged(product.id, 'allowsManualSaleValue')">
                <ng-container *ngIf="bulkEditMode; else readType">
                  <label class="table-toggle">
                    <input type="checkbox" formControlName="allowsManualSaleValue" (change)="toggleManualSaleValue(bulkForm(product.id), 'public', $any($event.target).checked, 'bulk')" />
                    <span class="table-toggle__text">{{ bulkForm(product.id).get('allowsManualSaleValue')?.value ? 'Canje / valor en venta' : 'Comun' }}</span>
                  </label>
                </ng-container>
                <ng-template #readType>
                  <span class="product-type-badge" [class.product-type-badge--special]="productAllowsManualSaleValue(product)">{{ productAllowsManualSaleValue(product) ? 'Valor en venta' : 'Comun' }}</span>
                </ng-template>
              </td>
              <td class="brand" [class.cell--changed]="isBulkFieldChanged(product.id, 'brand')" [class.cell--invalid]="isBulkFieldInvalid(product.id, 'brand')">
                <ng-container *ngIf="bulkEditMode; else readBrand">
                  <input class="field__input field__input--table field__input--table-accent" type="text" formControlName="brand" />
                </ng-container>
                <ng-template #readBrand>{{ product.brand }}</ng-template>
              </td>
              <td [class.cell--changed]="isBulkFieldChanged(product.id, 'name')" [class.cell--invalid]="isBulkFieldInvalid(product.id, 'name')">
                <ng-container *ngIf="bulkEditMode; else readName">
                  <input class="field__input field__input--table" type="text" formControlName="name" />
                </ng-container>
                <ng-template #readName>{{ product.name }}</ng-template>
              </td>
              <td [class.cell--changed]="isBulkFieldChanged(product.id, 'description')" [class.cell--invalid]="isBulkFieldInvalid(product.id, 'description')">
                <ng-container *ngIf="bulkEditMode; else readDescription">
                  <textarea class="field__input field__input--table field__input--table-area" formControlName="description"></textarea>
                </ng-container>
                <ng-template #readDescription>{{ product.description || 'Sin descripcion' }}</ng-template>
              </td>
              <td class="meta" [class.cell--changed]="isBulkFieldChanged(product.id, 'publicPrice')" [class.cell--invalid]="isBulkFieldInvalid(product.id, 'publicPrice')">
                <ng-container *ngIf="bulkEditMode; else readPublicPrice">
                  <input class="field__input field__input--table" type="number" min="0" step="0.01" formControlName="publicPrice" />
                  <small class="cell__hint" *ngIf="isBulkFieldInvalid(product.id, 'publicPrice')">Valor invalido</small>
                </ng-container>
                <ng-template #readPublicPrice>
                  <span *ngIf="!productAllowsManualSaleValue(product)">&#36;{{ visiblePrice(product) | number: '1.2-2' }}</span>
                  <span *ngIf="productAllowsManualSaleValue(product)" class="price-inline-note">Se define en venta</span>
                </ng-template>
              </td>
              <td class="meta" *ngIf="canViewCostPrice" [class.cell--changed]="isBulkFieldChanged(product.id, 'costPrice')" [class.cell--invalid]="isBulkFieldInvalid(product.id, 'costPrice')">
                <ng-container *ngIf="bulkEditMode; else readCostPrice">
                  <input class="field__input field__input--table" type="number" min="0" step="0.01" formControlName="costPrice" />
                  <small class="cell__hint" *ngIf="isBulkFieldInvalid(product.id, 'costPrice')">Valor invalido</small>
                </ng-container>
                <ng-template #readCostPrice>&#36;{{ (product.costPrice ?? 0) | number: '1.2-2' }}</ng-template>
              </td>
              <td class="meta" [class.cell--changed]="isBulkFieldChanged(product.id, 'unitPrice')" [class.cell--invalid]="isBulkFieldInvalid(product.id, 'unitPrice')">
                <ng-container *ngIf="bulkEditMode; else readUnitPrice">
                  <input class="field__input field__input--table" type="number" min="0" step="0.01" formControlName="unitPrice" placeholder="-" />
                  <small class="cell__hint" *ngIf="isBulkFieldInvalid(product.id, 'unitPrice')">Valor invalido</small>
                </ng-container>
                <ng-template #readUnitPrice>{{ product.unitPrice == null ? '-' : ('$' + (product.unitPrice | number: '1.2-2')) }}</ng-template>
              </td>
              <td class="meta">{{ product.totalOnHandQuantity }}</td>
              <td class="meta">{{ product.totalReservedQuantity }}</td>
              <td class="meta">{{ product.totalAvailableQuantity }}</td>
              <td>{{ (product.updatedAt || product.createdAt) | date: 'shortDate' }}</td>
              <td>
                <div class="action-stack">
                  <button class="btn-secondary btn-secondary--compact btn-secondary--stock" type="button" (click)="openStock(product)">Stock</button>
                  <button class="btn-secondary btn-secondary--compact btn-secondary--edit" type="button" *ngIf="!bulkEditMode" (click)="openEditor(product)">Editar</button>
                  <button class="btn-danger btn-secondary--compact" type="button" *ngIf="!bulkEditMode" (click)="openDelete(product)">Eliminar</button>
                  <span class="row-state" *ngIf="bulkEditMode && isBulkProductModified(product.id)">Modificado</span>
                  <span class="row-state row-state--invalid" *ngIf="bulkEditMode && !isBulkProductModified(product.id) && bulkForm(product.id).invalid">Revisar</span>
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
          <div class="field field--price-mode">
            <span class="field__label">Modo de precio</span>
            <div class="toggle-cluster">
              <label class="toggle-check">
                <input type="radio" name="editPriceMode" [checked]="editPriceMode === 'public'" (change)="setEditPriceMode('public')" [disabled]="modalMode === 'delete'" />
                <span class="toggle-check__track"></span>
                <span class="toggle-check__text">Precio publico</span>
              </label>
              <label class="toggle-check" *ngIf="canViewCostPrice">
                <input type="radio" name="editPriceMode" [checked]="editPriceMode === 'margin'" (change)="setEditPriceMode('margin')" [disabled]="modalMode === 'delete' || editForm.get('allowsManualSaleValue')?.value" />
                <span class="toggle-check__track"></span>
                <span class="toggle-check__text">Margen de ganancia</span>
              </label>
            </div>
          </div>
          <div class="field field--toggle-note">
            <span class="field__label">Uso en venta</span>
            <label class="toggle-check toggle-check--special">
              <input type="checkbox" formControlName="allowsManualSaleValue" [disabled]="modalMode === 'delete'" (change)="toggleManualSaleValue(editForm, editPriceMode, $any($event.target).checked, 'edit')" />
              <span class="toggle-check__track"></span>
              <span class="toggle-check__text">Producto para parte de pago / canje</span>
            </label>
            <small class="field__hint" *ngIf="editForm.get('allowsManualSaleValue')?.value">El producto queda identificado para canje y su valor final se define en la venta.</small>
          </div>
          <label class="field"><span class="field__label">{{ editPriceMode === 'margin' ? 'Margen %' : 'Precio publico' }}</span><input *ngIf="editPriceMode === 'public'" class="field__input" type="number" min="0" step="0.01" formControlName="publicPrice" [readonly]="modalMode === 'delete'" /><input *ngIf="editPriceMode === 'margin'" class="field__input" type="number" min="0" step="0.01" formControlName="marginPercent" [readonly]="modalMode === 'delete'" (input)="syncPriceFromMargin(editForm, editPriceMode)" /></label>
          <label class="field" *ngIf="canViewCostPrice"><span class="field__label">Precio costo</span><input class="field__input" type="number" min="0" step="0.01" formControlName="costPrice" [readonly]="modalMode === 'delete'" (input)="syncPriceFromMargin(editForm, editPriceMode)" /></label>
          <label class="field"><span class="field__label">Precio unitario</span><input class="field__input" type="number" min="0" step="0.01" formControlName="unitPrice" [readonly]="modalMode === 'delete'" /></label>
          <div class="price-preview-card price-preview-card--modal">
            <span class="field__label">Lectura comercial</span>
            <strong>{{ editForm.get('allowsManualSaleValue')?.value ? 'Valor definido en venta' : (publicPricePreview(editForm) | currency:'USD':'symbol':'1.2-2') }}</strong>
            <small *ngIf="editForm.get('allowsManualSaleValue')?.value">No se interpreta como producto gratis: el monto se carga manualmente cuando entra como parte de pago.</small>
            <small *ngIf="canViewCostPrice">Costo {{ costPricePreview(editForm) | currency:'USD':'symbol':'1.2-2' }} · Margen {{ marginPreview(editForm) | number:'1.0-0' }}%</small>
            <small *ngIf="!canViewCostPrice && !editForm.get('allowsManualSaleValue')?.value">Compatibilidad legacy activa via alias price.</small>
          </div>
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
    .form-grid{position:relative;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;align-items:start}.field{position:relative;display:block}.field--wide{grid-column:span 4}.field--price-primary,.field--price-mode,.field--toggle-note{grid-column:span 2}
    .field__label{display:block;margin-bottom:.45rem;color:var(--text-dim)}.field__input{width:100%;box-sizing:border-box;border:1px solid var(--border-2);background:var(--bg);color:var(--text);padding:.75rem .9rem;font-family:'DM Mono',monospace;font-size:.86rem;border-radius:2px;outline:none}
    .field__hint{display:block;margin-top:.45rem;color:var(--text-soft);font-family:'DM Mono',monospace;font-size:.66rem;line-height:1.45}
    .field__input:focus{border-color:var(--amber);box-shadow:0 0 0 3px var(--surface-glow)}.field__input[readonly]{background:var(--bg-soft);color:var(--text-dim);cursor:not-allowed}.field__input--area{min-height:88px;resize:vertical}.field__input--compact{padding:.55rem .75rem;font-size:.76rem}
    .toggle-cluster{display:grid;gap:.65rem}
    .toggle-check{position:relative;display:inline-flex;align-items:center;gap:.75rem;min-height:44px;padding:.55rem .8rem;border:1px solid var(--border-2);border-radius:2px;background:color-mix(in srgb,var(--bg-soft) 80%,transparent);cursor:pointer}
    .toggle-check--special{background:linear-gradient(135deg,color-mix(in srgb,var(--amber) 7%,transparent),color-mix(in srgb,var(--bg-soft) 82%,transparent));border-color:color-mix(in srgb,var(--amber) 20%,var(--border-2))}
    .toggle-check input{position:absolute;inset:0;opacity:0;cursor:pointer}
    .toggle-check__track{position:relative;display:inline-flex;width:2.25rem;height:1.3rem;border-radius:999px;background:color-mix(in srgb,var(--border-2) 75%,transparent);transition:background .2s ease}
    .toggle-check__track::after{content:'';position:absolute;top:.19rem;left:.14rem;width:.92rem;height:.92rem;border-radius:50%;background:var(--bg-panel);box-shadow:0 1px 2px rgba(0,0,0,.18);transition:transform .2s ease}
    .toggle-check input:checked + .toggle-check__track{background:color-mix(in srgb,var(--amber) 40%,transparent)}
    .toggle-check input:checked + .toggle-check__track::after{transform:translateX(.95rem);background:var(--amber)}
    .toggle-check__text{position:relative;z-index:1;color:var(--text);font-size:.76rem;font-family:'DM Mono',monospace}
    .btn-primary,.btn-secondary,.btn-danger{border-radius:2px;padding:.85rem 1.1rem;font-family:'DM Mono',monospace;font-size:.78rem;text-transform:uppercase;letter-spacing:.14em;cursor:pointer}
    .btn-primary{border:none;background:var(--amber);color:var(--bg)}.btn-primary--submit{align-self:end}.btn-primary:disabled,.btn-secondary:disabled,.btn-danger:disabled{opacity:.55;cursor:not-allowed}
    .btn-secondary{background:transparent;color:var(--text-dim);border:1px solid var(--border-2)}.btn-secondary--edit{color:var(--amber);border-color:color-mix(in srgb,var(--amber) 34%,var(--border-2));background:color-mix(in srgb,var(--amber) 6%,transparent)}.btn-secondary--stock{color:var(--success);border-color:color-mix(in srgb,var(--success) 34%,var(--border-2));background:color-mix(in srgb,var(--success) 6%,transparent)}.btn-secondary--edit-mode{color:var(--amber);border-color:color-mix(in srgb,var(--amber) 40%,var(--border-2));background:linear-gradient(135deg,color-mix(in srgb,var(--amber) 12%,transparent),transparent)}
    .btn-secondary--compact,.btn-danger{padding:.55rem .75rem;font-size:.66rem}.btn-danger{border:1px solid color-mix(in srgb,var(--danger) 45%,var(--border-2));background:transparent;color:var(--danger)}
    .bulk-edit-bar{display:flex;justify-content:space-between;gap:1rem;align-items:flex-end;flex-wrap:wrap;margin-bottom:1rem;padding:.95rem 1rem;border:1px solid color-mix(in srgb,var(--amber) 18%,var(--border));background:linear-gradient(135deg,color-mix(in srgb,var(--amber) 8%,transparent),color-mix(in srgb,var(--bg) 94%,transparent));border-radius:3px;position:relative}
    .bulk-edit-bar__copy{display:grid;gap:.22rem}.bulk-edit-bar__eyebrow,.bulk-edit-badge,.row-state{font-family:'DM Mono',monospace;font-size:.64rem;letter-spacing:.12em;text-transform:uppercase}
    .bulk-edit-bar__copy strong{color:var(--text);font-family:'DM Mono',monospace;font-size:.86rem}.bulk-edit-bar__copy small{color:var(--text-soft);font-family:'DM Mono',monospace;font-size:.68rem;line-height:1.5}
    .bulk-edit-bar__actions{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}.bulk-edit-badge,.row-state,.product-type-badge{display:inline-flex;align-items:center;justify-content:center;padding:.35rem .55rem;border-radius:999px;border:1px solid color-mix(in srgb,var(--amber) 30%,var(--border-2));background:color-mix(in srgb,var(--amber) 10%,transparent);color:var(--amber)}
    .product-type-badge{font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;padding:.28rem .5rem}
    .product-type-badge--special{background:linear-gradient(135deg,color-mix(in srgb,var(--amber) 14%,transparent),color-mix(in srgb,var(--bg) 88%,transparent));border-color:color-mix(in srgb,var(--amber) 34%,var(--border-2));color:var(--text)}
    .table-toggle{display:grid;gap:.35rem}.table-toggle input{accent-color:var(--amber)}.table-toggle__text,.price-inline-note{font-family:'DM Mono',monospace;font-size:.64rem;line-height:1.4;color:var(--text-dim);text-transform:uppercase;letter-spacing:.08em}
    .row-state--invalid{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 30%,var(--border-2));background:color-mix(in srgb,var(--danger) 8%,transparent)}
    .table-wrap{overflow-x:auto;position:relative;padding-bottom:.25rem}.product-table{width:100%;border-collapse:collapse;min-width:1320px}.product-table th{color:var(--text-subtle);text-align:left;padding:0 .8rem .8rem 0;border-bottom:1px solid var(--border)}
    .product-table td{padding:.95rem .8rem .95rem 0;color:var(--text);border-bottom:1px solid color-mix(in srgb,var(--border) 65%,transparent);font-family:'Crimson Pro',serif;font-size:.96rem;vertical-align:top;transition:background .18s ease,box-shadow .18s ease,border-color .18s ease;position:relative}.product-table tbody tr:hover{background:color-mix(in srgb,var(--amber) 4%,transparent)}
    .product-row--bulk{background:color-mix(in srgb,var(--bg-panel) 86%,transparent)}.product-row--changed{box-shadow:inset 3px 0 0 color-mix(in srgb,var(--amber) 36%,transparent)}.product-row--invalid{box-shadow:inset 3px 0 0 color-mix(in srgb,var(--danger) 34%,transparent)}
    .cell--changed{background:linear-gradient(180deg,color-mix(in srgb,var(--amber) 6%,transparent),transparent 72%);border-bottom-color:color-mix(in srgb,var(--amber) 28%,var(--border))}
    .cell--changed::after{content:'';position:absolute;left:.15rem;right:.15rem;bottom:.28rem;height:2px;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--amber) 18%,transparent),color-mix(in srgb,var(--amber) 52%,transparent),color-mix(in srgb,var(--amber) 18%,transparent));pointer-events:none}
    .cell--invalid{background:linear-gradient(180deg,color-mix(in srgb,var(--danger) 7%,transparent),transparent 72%);border-bottom-color:color-mix(in srgb,var(--danger) 28%,var(--border))}
    .cell--invalid::after{content:'';position:absolute;left:.15rem;right:.15rem;bottom:.28rem;height:2px;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--danger) 18%,transparent),color-mix(in srgb,var(--danger) 48%,transparent),color-mix(in srgb,var(--danger) 18%,transparent));pointer-events:none}
    .cell--changed .field__input--table{border-color:color-mix(in srgb,var(--amber) 42%,var(--border-2));background:linear-gradient(180deg,color-mix(in srgb,var(--amber) 8%,transparent),color-mix(in srgb,var(--bg) 92%,transparent));box-shadow:0 0 0 3px color-mix(in srgb,var(--amber) 6%,transparent)}
    .cell--invalid .field__input--table{border-color:color-mix(in srgb,var(--danger) 42%,var(--border-2));background:linear-gradient(180deg,color-mix(in srgb,var(--danger) 8%,transparent),color-mix(in srgb,var(--bg) 92%,transparent));box-shadow:0 0 0 3px color-mix(in srgb,var(--danger) 6%,transparent)}
    .field__input--table{min-width:9rem;padding:.58rem .65rem;font-size:.74rem;background:color-mix(in srgb,var(--bg) 92%,transparent);transition:border-color .18s ease,box-shadow .18s ease,background .18s ease}.field__input--table-accent{color:var(--amber)}.field__input--table-area{min-height:76px;resize:vertical}
    .cell__hint{display:block;margin-top:.35rem;color:var(--danger);font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.08em;text-transform:uppercase}
    .pagination{position:relative;display:flex;justify-content:space-between;gap:1rem;align-items:center;margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)}
    .pagination__summary,.pagination__current{font-family:'DM Mono',monospace;font-size:.72rem;color:var(--text-dim)}
    .pagination__actions{display:flex;align-items:flex-end;gap:.75rem;flex-wrap:wrap}
    .pagination__size{display:grid;gap:.35rem;min-width:5.5rem}
    .meta,.brand{font-family:'DM Mono',monospace;font-size:.8rem}.meta{color:var(--text-dim)}.brand{color:var(--amber)}.action-stack{display:grid;gap:.45rem;min-width:9rem}
    .price-preview-card{display:grid;gap:.32rem;align-self:stretch;padding:1rem 1.1rem;border:1px solid color-mix(in srgb,var(--amber) 24%,var(--border));background:linear-gradient(160deg,color-mix(in srgb,var(--amber) 9%,transparent),color-mix(in srgb,var(--bg) 92%,transparent));border-radius:3px;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--amber) 10%,transparent)}
    .price-preview-card strong{color:var(--text);font-family:'DM Mono',monospace;font-size:1.25rem}
    .price-preview-card small{color:var(--text-soft);font-family:'DM Mono',monospace;font-size:.68rem;line-height:1.5}
    .price-preview-card--modal{margin-top:1rem}
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
    @media (max-width:860px){.form-grid{grid-template-columns:1fr}.field--wide,.field--price-primary{grid-column:auto}.stock-form,.stock-summary{grid-template-columns:1fr}.pagination,.bulk-edit-bar{display:grid;align-items:stretch}.pagination__actions,.bulk-edit-bar__actions{align-items:stretch}.bulk-edit-bar__actions .btn-primary,.bulk-edit-bar__actions .btn-secondary{width:100%}}
  `]
})
export class ProductsComponent implements OnInit {
  createPriceMode: 'public' | 'margin' = 'public';
  editPriceMode: 'public' | 'margin' = 'public';
  createForm: FormGroup;
  editForm: FormGroup;
  stockForm: FormGroup;
  bulkEditForms: Record<string, FormGroup> = {};
  bulkEditSnapshots: Record<string, ReturnType<ProductsComponent['toProductRequest']>> = {};
  modifiedBulkProductIds = new Set<string>();
  products: ProductResponse[] = [];
  branches: BranchResponse[] = [];
  readonly pageSizeOptions = [10, 25, 50];
  loading = false;
  creating = false;
  updating = false;
  deleting = false;
  stockSaving = false;
  stockLoading = false;
  bulkEditMode = false;
  bulkEditSaving = false;
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
    private router: Router,
    public auth: AuthService
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

  get canViewCostPrice(): boolean {
    return this.auth.hasRole('owner') || this.auth.hasRole('admin');
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

  get modifiedProductsCount(): number {
    return this.modifiedBulkProductIds.size;
  }

  get invalidBulkRowsCount(): number {
    return this.products.filter(product => {
      const form = this.bulkEditForms[product.id];
      return !!form && this.modifiedBulkProductIds.has(product.id) && form.invalid;
    }).length;
  }

  visiblePrice(product: ProductResponse): number {
    return productPublicPrice(product);
  }

  productAllowsManualSaleValue(product: ProductResponse): boolean {
    return productAllowsManualSaleValue(product);
  }

  publicPricePreview(form: FormGroup): number {
    return Number(form.get('publicPrice')?.value ?? form.get('price')?.value ?? 0);
  }

  costPricePreview(form: FormGroup): number {
    return Number(form.get('costPrice')?.value ?? 0);
  }

  marginPreview(form: FormGroup): number {
    const publicPrice = this.publicPricePreview(form);
    const costPrice = this.costPricePreview(form);
    if (costPrice <= 0 || publicPrice < 0) {
      return 0;
    }

    return ((publicPrice - costPrice) / costPrice) * 100;
  }

  setCreatePriceMode(mode: 'public' | 'margin'): void {
    if (this.createForm.get('allowsManualSaleValue')?.value) {
      this.createPriceMode = 'public';
      this.syncPriceMode(this.createForm, this.createPriceMode);
      return;
    }
    this.createPriceMode = this.canViewCostPrice ? mode : 'public';
    this.syncPriceMode(this.createForm, this.createPriceMode);
  }

  setEditPriceMode(mode: 'public' | 'margin'): void {
    if (this.editForm.get('allowsManualSaleValue')?.value) {
      this.editPriceMode = 'public';
      this.syncPriceMode(this.editForm, this.editPriceMode);
      return;
    }
    this.editPriceMode = this.canViewCostPrice ? mode : 'public';
    this.syncPriceMode(this.editForm, this.editPriceMode);
  }

  toggleManualSaleValue(form: FormGroup, mode: 'public' | 'margin', checked: boolean, context: 'create' | 'edit' | 'bulk'): void {
    form.patchValue({ allowsManualSaleValue: checked }, { emitEvent: false });
    this.updatePriceValidators(form);

    if (checked) {
      form.patchValue({ publicPrice: 0, price: 0, marginPercent: 0 }, { emitEvent: false });

      if (context === 'create') {
        this.createPriceMode = 'public';
      }

      if (context === 'edit') {
        this.editPriceMode = 'public';
      }
    } else {
      const fallbackPrice = Number(form.get('publicPrice')?.value ?? form.get('price')?.value ?? 0);
      form.patchValue({ publicPrice: fallbackPrice > 0 ? fallbackPrice : 0.01, price: fallbackPrice > 0 ? fallbackPrice : 0.01 }, { emitEvent: false });
      this.syncPriceMode(form, mode);
    }

    form.get('publicPrice')?.markAsTouched();
    form.get('publicPrice')?.updateValueAndValidity({ emitEvent: false });
  }

  syncPriceFromMargin(form: FormGroup, mode: 'public' | 'margin'): void {
    if (mode !== 'margin') {
      return;
    }

    const costPrice = Number(form.get('costPrice')?.value ?? 0);
    const marginPercent = Number(form.get('marginPercent')?.value ?? 0);
    const publicPrice = costPrice > 0 ? costPrice * (1 + (marginPercent / 100)) : 0;
    form.patchValue({ publicPrice, price: publicPrice }, { emitEvent: false });
  }

  create(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.creating = true;
    this.productService.createProduct(this.toProductRequest(this.createForm)).subscribe({
      next: (product) => {
        this.createForm.reset({ code: '', sku: '', brand: '', name: '', description: '', publicPrice: 0, price: 0, costPrice: 0, unitPrice: null, marginPercent: 0 });
        this.createForm.patchValue({ allowsManualSaleValue: false }, { emitEvent: false });
        this.updatePriceValidators(this.createForm);
        this.createPriceMode = 'public';
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
    if (!this.canLeaveBulkEdit()) {
      return;
    }
    this.modalMode = 'edit';
    this.openModal(product);
  }

  openDelete(product: ProductResponse): void {
    if (!this.canLeaveBulkEdit()) {
      return;
    }
    this.modalMode = 'delete';
    this.openModal(product);
  }

  openStock(product: ProductResponse): void {
    if (!this.canLeaveBulkEdit()) {
      return;
    }
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
    this.productService.updateProduct(this.selectedProduct.id, this.toProductRequest(this.editForm)).subscribe({
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
    if (this.showListPanel && !this.canLeaveBulkEdit()) {
      return;
    }
    this.showListPanel = !this.showListPanel;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }

    if (!this.canLeaveBulkEdit()) {
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

    if (!this.canLeaveBulkEdit()) {
      return;
    }

    this.pageSize = parsedPageSize;
    this.currentPage = 1;
    this.loadProducts();
  }

  enterBulkEditMode(): void {
    this.bulkEditMode = true;
    this.bulkEditSaving = false;
    this.bulkEditForms = {};
    this.bulkEditSnapshots = {};
    this.modifiedBulkProductIds = new Set<string>();

    for (const product of this.products) {
      const form = this.buildForm();
      form.reset(this.bulkProductFormValue(product));
      this.updatePriceValidators(form);
      this.bulkEditForms[product.id] = form;
      this.bulkEditSnapshots[product.id] = this.toProductRequest(form);
      form.valueChanges.subscribe(() => this.refreshBulkProductState(product.id));
    }
  }

  cancelBulkEdit(force = false): void {
    if (!force && this.hasPendingBulkChanges() && !window.confirm('Hay cambios sin guardar en la grilla. Si continuas, se perderan.')) {
      return;
    }

    this.bulkEditMode = false;
    this.bulkEditSaving = false;
    this.bulkEditForms = {};
    this.bulkEditSnapshots = {};
    this.modifiedBulkProductIds = new Set<string>();
  }

  saveBulkChanges(): void {
    if (!this.bulkEditMode || this.bulkEditSaving) {
      return;
    }

    const modifiedProducts = this.products.filter(product => this.modifiedBulkProductIds.has(product.id));

    if (modifiedProducts.length === 0) {
      this.toast.error('No hay cambios para guardar.');
      return;
    }

    const invalidForms = modifiedProducts
      .map(product => this.bulkEditForms[product.id])
      .filter((form): form is FormGroup => !!form && form.invalid);

    if (invalidForms.length > 0) {
      invalidForms.forEach(form => form.markAllAsTouched());
      this.toast.error('Revisa las celdas marcadas antes de confirmar.');
      return;
    }

    this.bulkEditSaving = true;
    const requests = modifiedProducts.map(product =>
      this.productService.updateProduct(product.id, this.toProductRequest(this.bulkEditForms[product.id]))
    );

    forkJoin(requests).subscribe({
      next: updatedProducts => {
        const updatedMap = new Map(updatedProducts.map(product => [product.id, product]));
        this.products = this.products.map(product => updatedMap.get(product.id) ?? product);
        this.bulkEditSaving = false;
        this.toast.success(`${updatedProducts.length} producto(s) actualizados.`);
        this.cancelBulkEdit(true);
      },
      error: err => {
        this.bulkEditSaving = false;
        this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron guardar los cambios masivos');
      }
    });
  }

  bulkForm(productId: string): FormGroup {
    return this.bulkEditForms[productId] ?? this.editForm;
  }

  isBulkProductModified(productId: string): boolean {
    return this.bulkEditMode && this.modifiedBulkProductIds.has(productId);
  }

  isBulkFieldChanged(productId: string, field: string): boolean {
    if (!this.bulkEditMode || !this.isBulkProductModified(productId)) {
      return false;
    }

    const form = this.bulkEditForms[productId];
    const snapshot = this.bulkEditSnapshots[productId];
    if (!form || !snapshot) {
      return false;
    }

    const current = this.normalizeBulkRequest(this.toProductRequest(form)) as Record<string, unknown>;
    const base = this.normalizeBulkRequest(snapshot) as Record<string, unknown>;
    if (field === 'allowsManualSaleValue') {
      return current['allowsManualSaleValue'] !== base['allowsManualSaleValue'];
    }
    return current[field] !== base[field];
  }

  isBulkFieldInvalid(productId: string, field: string): boolean {
    if (!this.bulkEditMode) {
      return false;
    }

    const control = this.bulkEditForms[productId]?.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.hasPendingBulkChanges()) {
      return;
    }

    event.preventDefault();
    event.returnValue = true;
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
        if (this.bulkEditMode) {
          this.enterBulkEditMode();
        }
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'No se pudieron cargar los productos');
        this.products = [];
        this.totalProducts = 0;
        this.totalPages = 1;
        this.loading = false;
        this.cancelBulkEdit(true);
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
    this.editPriceMode = productAllowsManualSaleValue(product) ? 'public' : 'public';
    this.editForm.reset({
      code: product.code,
      sku: product.sku,
      brand: product.brand,
      name: product.name,
      description: product.description ?? '',
      publicPrice: product.publicPrice ?? product.price,
      price: product.publicPrice ?? product.price,
      costPrice: product.costPrice ?? 0,
      unitPrice: product.unitPrice ?? null,
      marginPercent: this.calculateMarginPercent(product.publicPrice ?? product.price, product.costPrice ?? 0),
      allowsManualSaleValue: productAllowsManualSaleValue(product)
    });
    this.updatePriceValidators(this.editForm);
  }

  private bulkProductFormValue(product: ProductResponse) {
    return {
      code: product.code,
      sku: product.sku,
      brand: product.brand,
      name: product.name,
      description: product.description ?? '',
      publicPrice: product.publicPrice ?? product.price,
      price: product.publicPrice ?? product.price,
      costPrice: product.costPrice ?? 0,
      unitPrice: product.unitPrice ?? null,
      marginPercent: this.calculateMarginPercent(product.publicPrice ?? product.price, product.costPrice ?? 0),
      allowsManualSaleValue: productAllowsManualSaleValue(product)
    };
  }

  private hasPendingBulkChanges(): boolean {
    return this.bulkEditMode && this.modifiedBulkProductIds.size > 0;
  }

  private canLeaveBulkEdit(): boolean {
    if (!this.bulkEditMode) {
      return true;
    }

    if (!this.hasPendingBulkChanges()) {
      this.cancelBulkEdit(true);
      return true;
    }

    const shouldLeave = window.confirm('Hay cambios sin guardar en la grilla. Si sales del modo edicion, se perderan.');
    if (shouldLeave) {
      this.cancelBulkEdit(true);
    }

    return shouldLeave;
  }

  private refreshBulkProductState(productId: string): void {
    const form = this.bulkEditForms[productId];
    const snapshot = this.bulkEditSnapshots[productId];
    if (!form || !snapshot) {
      return;
    }

    const current = this.normalizeBulkRequest(this.toProductRequest(form));
    const base = this.normalizeBulkRequest(snapshot);

    if (this.areBulkRequestsEqual(current, base)) {
      this.modifiedBulkProductIds.delete(productId);
      return;
    }

    this.modifiedBulkProductIds.add(productId);
  }

  private normalizeBulkRequest(request: ReturnType<ProductsComponent['toProductRequest']>) {
    return {
      code: request.code.trim(),
      sku: request.sku.trim(),
      brand: request.brand.trim(),
      name: request.name.trim(),
      description: request.description ?? null,
      publicPrice: Number(request.publicPrice ?? 0),
      price: Number(request.price ?? 0),
      costPrice: Number(request.costPrice ?? 0),
      unitPrice: request.unitPrice == null ? null : Number(request.unitPrice),
      allowsManualValueInSale: Boolean(request.allowsManualValueInSale)
    };
  }

  private areBulkRequestsEqual(
    left: ReturnType<ProductsComponent['toProductRequest']>,
    right: ReturnType<ProductsComponent['toProductRequest']>
  ): boolean {
    return left.code === right.code
      && left.sku === right.sku
      && left.brand === right.brand
      && left.name === right.name
      && left.description === right.description
      && left.publicPrice === right.publicPrice
      && left.price === right.price
      && left.costPrice === right.costPrice
      && left.unitPrice === right.unitPrice
      && left.allowsManualValueInSale === right.allowsManualValueInSale;
  }

  private buildForm(): FormGroup {
    const form = this.fb.group({
      code: ['', [Validators.required, Validators.maxLength(50)]],
      sku: ['', [Validators.required, Validators.maxLength(80)]],
      brand: ['', [Validators.required, Validators.maxLength(100)]],
      name: ['', [Validators.required, Validators.maxLength(150)]],
      description: ['', [Validators.maxLength(1000)]],
      publicPrice: [0, [Validators.required, Validators.min(0)]],
      price: [0],
      costPrice: [0, [Validators.required, Validators.min(0)]],
      unitPrice: [null, [Validators.min(0)]],
      marginPercent: [0, [Validators.min(0)]],
      allowsManualSaleValue: [false]
    });

    this.updatePriceValidators(form);
    return form;
  }

  private syncPriceMode(form: FormGroup, mode: 'public' | 'margin'): void {
    if (form.get('allowsManualSaleValue')?.value) {
      form.patchValue({ publicPrice: 0, price: 0, marginPercent: 0 }, { emitEvent: false });
      return;
    }

    if (mode === 'margin') {
      form.patchValue({
        marginPercent: this.calculateMarginPercent(
          Number(form.get('publicPrice')?.value ?? form.get('price')?.value ?? 0),
          Number(form.get('costPrice')?.value ?? 0)
        )
      }, { emitEvent: false });
      this.syncPriceFromMargin(form, mode);
      return;
    }

    const publicPrice = Number(form.get('publicPrice')?.value ?? form.get('price')?.value ?? 0);
    form.patchValue({ publicPrice, price: publicPrice }, { emitEvent: false });
  }

  private calculateMarginPercent(publicPrice: number, costPrice: number): number {
    if (costPrice <= 0 || publicPrice < 0) {
      return 0;
    }

    return ((publicPrice - costPrice) / costPrice) * 100;
  }

  private toProductRequest(form: FormGroup) {
    const raw = form.getRawValue();
    const allowsManualSaleValue = Boolean(raw.allowsManualSaleValue);
    const publicPrice = allowsManualSaleValue ? 0 : Number(raw.publicPrice ?? raw.price ?? 0);

    return {
      code: String(raw.code || ''),
      sku: String(raw.sku || ''),
      brand: String(raw.brand || ''),
      name: String(raw.name || ''),
      description: raw.description?.trim() ? raw.description.trim() : null,
      publicPrice,
      price: publicPrice,
      costPrice: Number(raw.costPrice ?? 0),
      unitPrice: raw.unitPrice === null || raw.unitPrice === '' ? null : Number(raw.unitPrice),
      allowsManualValueInSale: allowsManualSaleValue
    };
  }

  private updatePriceValidators(form: FormGroup): void {
    const allowsManualSaleValue = Boolean(form.get('allowsManualSaleValue')?.value);
    const publicPriceControl = form.get('publicPrice');

    if (!publicPriceControl) {
      return;
    }

    publicPriceControl.setValidators([
      Validators.required,
      Validators.min(allowsManualSaleValue ? 0 : 0.01)
    ]);

    publicPriceControl.updateValueAndValidity({ emitEvent: false });
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
