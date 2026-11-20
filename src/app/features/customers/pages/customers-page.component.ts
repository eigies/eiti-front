import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent } from '../../../shared/ui';
import { CustomersFacade } from '../data-access/customers.facade';
import { CustomerFormModalComponent } from '../components/customer-form-modal/customer-form-modal.component';
import { CustomerTableComponent } from '../components/customer-table/customer-table.component';

/** Contenedor de /customers: conecta la facade con la tabla y el popup de alta/edición. */
@Component({
  selector: 'app-customers-page',
  standalone: true,
  imports: [CommonModule, UiButtonComponent, UiCardComponent, UiEmptyComponent, CustomerTableComponent, CustomerFormModalComponent],
  providers: [CustomersFacade],
  templateUrl: './customers-page.component.html',
  styleUrls: ['./customers-page.component.css']
})
export class CustomersPageComponent implements OnInit {
  readonly facade = inject(CustomersFacade);

  ngOnInit(): void {
    this.facade.init();
  }
}
