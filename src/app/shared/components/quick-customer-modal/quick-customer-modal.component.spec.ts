import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CustomerResponse } from '../../../core/models/customer.models';
import { CustomerService } from '../../../core/services/customer.service';
import { ToastService } from '../../services/toast.service';
import { QuickCustomerModalComponent } from './quick-customer-modal.component';

describe('QuickCustomerModalComponent', () => {
  let fixture: ComponentFixture<QuickCustomerModalComponent>;
  let component: QuickCustomerModalComponent;
  let customers: jasmine.SpyObj<CustomerService>;

  beforeEach(() => {
    customers = jasmine.createSpyObj('CustomerService', ['createCustomer']);
    customers.createCustomer.and.returnValue(of({ id: 'c1', name: 'Distribuidora Sur', fullName: 'Distribuidora Sur' } as CustomerResponse));
    TestBed.configureTestingModule({
      imports: [QuickCustomerModalComponent],
      providers: [
        { provide: CustomerService, useValue: customers },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) }
      ]
    });
    fixture = TestBed.createComponent(QuickCustomerModalComponent);
    component = fixture.componentInstance;
    component.initialFirstName = 'Distribuidora';
    component.initialLastName = 'Sur';
    component.ngOnChanges();
  });

  it('sin abrir los datos de facturación no los manda', () => {
    component.submit();

    expect(customers.createCustomer).toHaveBeenCalledWith(jasmine.objectContaining({ taxId: null, ivaCondition: null }));
  });

  it('con los datos abiertos manda CUIT y condición, para poder hacer Factura A después', () => {
    component.billingOpen = true;
    component.form.patchValue({ ivaCondition: 1, taxId: '30-50001091-2' });

    component.submit();

    expect(customers.createCustomer).toHaveBeenCalledWith(jasmine.objectContaining({ taxId: '30-50001091-2', ivaCondition: 1 }));
  });

  it('un CUIT inválido no deja crear el cliente', () => {
    component.billingOpen = true;
    component.form.patchValue({ taxId: '30-50001091-3' });

    component.submit();

    expect(component.taxIdIssue).toContain('CUIT no es válido');
    expect(customers.createCustomer).not.toHaveBeenCalled();
  });
});
