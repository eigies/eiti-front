import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent } from '../../../../shared/ui';
import { StockMatrixFacade } from '../data-access/stock-matrix.facade';

/** Contenedor de Stock por sucursal (plantilla B). Sin importes: no lleva ticket. */
@Component({
  selector: 'app-stock-matrix-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent],
  providers: [StockMatrixFacade],
  templateUrl: './stock-matrix-page.component.html',
  styleUrls: ['../../reports.shared.css', './stock-matrix-page.component.css']
})
export class StockMatrixPageComponent implements OnInit {
  readonly facade = inject(StockMatrixFacade);

  ngOnInit(): void {
    this.facade.init();
  }
}
