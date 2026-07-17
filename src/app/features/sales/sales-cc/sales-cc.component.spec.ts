import { of } from 'rxjs';
import { SalesCcComponent } from './sales-cc.component';
import { BranchService } from '../../../core/services/branch.service';
import { CustomerService } from '../../../core/services/customer.service';
import { StockService } from '../../../core/services/stock.service';
import { SaleService } from '../../../core/services/sale.service';
import { ToastService } from '../../../shared/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { QuoteService } from '../../../core/services/quote.service';
import { BranchResponse } from '../../../core/models/branch.models';
import { BranchProductStockResponse } from '../../../core/models/stock.models';
import { CustomerResponse } from '../../../core/models/customer.models';

describe('SalesCcComponent quote conversion', () => {
  const branch: BranchResponse = {
    id: 'branch-1',
    name: 'Centro',
    code: 'CEN',
    address: 'Street 1',
    salesCount: 0,
    cashValue: 0,
    createdAt: '2026-07-16T00:00:00Z'
  };

  const stock: BranchProductStockResponse = {
    productId: 'product-1',
    branchId: 'branch-1',
    code: 'BAT-1',
    sku: 'SKU-1',
    brand: 'Bosch',
    name: 'Bateria 75',
    price: 120,
    publicPrice: 120,
    costPrice: null,
    unitPrice: null,
    allowsManualValueInSale: false,
    onHandQuantity: 10,
    reservedQuantity: 0,
    availableQuantity: 10
  };

  const customer: CustomerResponse = {
    id: 'customer-1',
    name: 'ACME',
    firstName: '',
    lastName: '',
    fullName: 'ACME SA',
    email: 'ventas@acme.test',
    phone: '123',
    documentType: null,
    documentTypeName: null,
    documentNumber: null,
    taxId: null,
    addressId: null,
    address: null,
    createdAt: '2026-07-16T00:00:00Z',
    updatedAt: null,
    creditBalance: 0
  };

  function buildComponent() {
    const branchService = jasmine.createSpyObj<BranchService>('BranchService', ['listBranches']);
    branchService.listBranches.and.returnValue(of([branch]));

    const customerService = jasmine.createSpyObj<CustomerService>('CustomerService', ['getCustomerById', 'searchCustomers']);
    customerService.getCustomerById.and.returnValue(of(customer));
    customerService.searchCustomers.and.returnValue(of([]));

    const stockService = jasmine.createSpyObj<StockService>('StockService', ['listBranchStock']);
    stockService.listBranchStock.and.returnValue(of([stock]));

    const saleService = jasmine.createSpyObj<SaleService>('SaleService', ['createCcSale']);
    saleService.createCcSale.and.returnValue(of({ id: 'sale-direct' }));

    const quoteService = jasmine.createSpyObj<QuoteService>('QuoteService', ['convertQuote']);
    quoteService.convertQuote.and.returnValue(of({ id: 'sale-from-quote' }));

    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['hasPermission']);
    auth.hasPermission.and.returnValue(true);

    const component = new (SalesCcComponent as any)(
      branchService,
      customerService,
      stockService,
      saleService,
      quoteService,
      toast,
      auth
    );

    return { component, branchService, customerService, stockService, saleService, quoteService, toast };
  }

  it('prefills quote items and converts the quote instead of creating a direct CC sale', () => {
    history.replaceState({
      quotePrefill: {
        quoteId: 'quote-1',
        branchId: 'branch-1',
        customerId: 'customer-1',
        customerFullName: 'ACME SA',
        prospectName: null,
        generalDiscountPercent: 12,
        details: [{
          productId: 'product-1',
          productName: 'Bateria 75',
          productBrand: 'Bosch',
          quantity: 2,
          unitPrice: 99,
          discountPercent: 5
        }]
      }
    }, '');

    const { component, customerService, stockService, saleService, quoteService } = buildComponent();

    component.ngOnInit();

    expect((component as any).convertingQuoteId).toBe('quote-1');
    expect(component.selectedBranchId).toBe('branch-1');
    expect(component.generalDiscountPercent).toBe(12);
    expect(customerService.getCustomerById).toHaveBeenCalledOnceWith('customer-1');
    expect(stockService.listBranchStock).toHaveBeenCalledOnceWith('branch-1');
    expect(component.draftItems.length).toBe(1);
    expect(component.draftItems[0].quantity).toBe(2);
    expect(component.draftItems[0].unitPriceOverride).toBe(99);
    expect(component.draftItems[0].discountPercent).toBe(5);

    component.submit();

    expect(quoteService.convertQuote).toHaveBeenCalledOnceWith('quote-1', jasmine.objectContaining({
      branchId: 'branch-1',
      customerId: 'customer-1',
      generalDiscountPercent: 12,
      details: [jasmine.objectContaining({
        productId: 'product-1',
        quantity: 2,
        unitPrice: 99,
        discountPercent: 5
      })]
    }));
    expect(saleService.createCcSale).not.toHaveBeenCalled();
  });
});
