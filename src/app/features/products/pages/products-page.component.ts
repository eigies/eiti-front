import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductResponse } from '../../../core/models/product.models';
import { OnboardingBannerComponent } from '../../../shared/components/onboarding-banner/onboarding-banner.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent } from '../../../shared/ui';
import { ProductsFacade } from '../data-access/products.facade';
import { DeleteProductModalComponent } from '../components/delete-product-modal/delete-product-modal.component';
import { PurchaseDetailModalComponent } from '../components/movement-detail-modals/purchase-detail-modal.component';
import { ReservationsModalComponent } from '../components/movement-detail-modals/reservations-modal.component';
import { SaleDetailModalComponent } from '../components/movement-detail-modals/sale-detail-modal.component';
import { TransferDetailModalComponent } from '../components/movement-detail-modals/transfer-detail-modal.component';
import { ProductCardsComponent } from '../components/product-cards/product-cards.component';
import { ProductDetailCardComponent } from '../components/product-detail-card/product-detail-card.component';
import { ProductEditCardComponent } from '../components/product-edit-card/product-edit-card.component';
import { ProductFiltersComponent } from '../components/product-filters/product-filters.component';
import { ProductFormModalComponent } from '../components/product-form-modal/product-form-modal.component';
import { ProductImportReportComponent } from '../components/product-import-report/product-import-report.component';
import { ProductStockCardComponent } from '../components/product-stock-card/product-stock-card.component';
import { ProductTableComponent } from '../components/product-table/product-table.component';

/**
 * Contenedor de /products, /products/new y /products/:id.
 * Conecta la facade con los bloques de presentación y maneja rutas, archivo de importación y salida.
 */
@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, OnboardingBannerComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent,
    ProductFiltersComponent, ProductImportReportComponent, ProductTableComponent, ProductCardsComponent,
    ProductFormModalComponent, ProductDetailCardComponent, ProductEditCardComponent, ProductStockCardComponent,
    DeleteProductModalComponent, SaleDetailModalComponent, PurchaseDetailModalComponent,
    TransferDetailModalComponent, ReservationsModalComponent
  ],
  providers: [ProductsFacade],
  templateUrl: './products-page.component.html',
  styleUrls: ['./products-page.component.css']
})
export class ProductsPageComponent implements OnInit {
  @ViewChild('importFileInput') importFileInput?: ElementRef<HTMLInputElement>;

  readonly facade = inject(ProductsFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.facade.applyRoute(params.get('id') ?? '', this.router.url.endsWith('/new'));
    });
    this.facade.importInputReset$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.importFileInput?.nativeElement) {
        this.importFileInput.nativeElement.value = '';
      }
    });
    this.facade.init();
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.facade.hasPendingChanges) {
      return;
    }

    event.preventDefault();
    event.returnValue = true;
  }

  async goToList(): Promise<void> {
    if (!(await this.facade.canLeaveBulkEdit())) {
      return;
    }
    this.router.navigate(['/products']);
  }

  async goToCreate(): Promise<void> {
    if (!(await this.facade.canLeaveBulkEdit())) {
      return;
    }
    this.router.navigate(['/products/new']);
  }

  async goToProduct(product: ProductResponse): Promise<void> {
    if (this.facade.bulkEditMode || !(await this.facade.canLeaveBulkEdit())) {
      return;
    }
    this.router.navigate(['/products', product.id]);
  }

  async openEditor(product: ProductResponse): Promise<void> {
    if (!(await this.facade.canLeaveBulkEdit())) {
      return;
    }
    this.router.navigate(['/products', product.id]);
  }

  async openImportPicker(): Promise<void> {
    if (this.facade.importInProgress || !(await this.facade.canLeaveBulkEdit())) {
      return;
    }

    this.importFileInput?.nativeElement.click();
  }

  setPageSize(value: string): void {
    this.facade.changePageSize(value);
  }
}
