import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ImportProductsResponse } from '../../../../core/models/product.models';
import { ImportBranchPricingResponse } from '../../../../core/models/stock.models';
import { UiButtonComponent } from '../../../../shared/ui';

/** Resultado de la importación por Excel (productos y precios por sucursal). */
@Component({
  selector: 'app-product-import-report',
  standalone: true,
  imports: [CommonModule, UiButtonComponent],
  templateUrl: './product-import-report.component.html',
  styleUrls: ['./product-import-report.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductImportReportComponent {
  @Input() report: ImportProductsResponse | null = null;
  @Input() pricing: ImportBranchPricingResponse | null = null;
  @Output() closed = new EventEmitter<void>();

  get reportErrors() {
    return this.report?.rows.filter(row => row.action === 'error') ?? [];
  }

  get pricingErrors() {
    return this.pricing?.rows.filter(row => row.action === 'error') ?? [];
  }
}
