import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SalesFullComponent } from './sales-full.component';
import { AuthService } from '../../core/services/auth.service';
import { ProductService } from '../../core/services/product.service';
import { SaleService } from '../../core/services/sale.service';
import { CompanyService } from '../../core/services/company.service';
import { CustomerService } from '../../core/services/customer.service';
import { BranchService } from '../../core/services/branch.service';
import { CashService } from '../../core/services/cash.service';
import { StockService } from '../../core/services/stock.service';
import { EmployeeService } from '../../core/services/employee.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { ToastService } from '../../shared/services/toast.service';
import { PermissionCodes } from '../../core/models/permission.models';
import { of } from 'rxjs';

describe('SalesFullComponent (price override)', () => {
    let component: SalesFullComponent;
    let authSpy: jasmine.SpyObj<AuthService>;

    function createMockService<T>(methods: string[]): jasmine.SpyObj<T> {
        return jasmine.createSpyObj(methods) as jasmine.SpyObj<T>;
    }

    beforeEach(() => {
        authSpy = jasmine.createSpyObj('AuthService', ['hasPermission', 'getToken', 'isAuthenticated'], { currentUser$: of(null), currentUser: null });
        const productSpy = createMockService<ProductService>(['listProducts']);
        (productSpy as any).listProducts.and.returnValue(of([]));
        const saleSpy = createMockService<SaleService>(['createSale', 'createTransport']);
        const companySpy = createMockService<CompanyService>(['getCurrentCompany']);
        (companySpy as any).getCurrentCompany.and.returnValue(of({}));
        const customerSpy = createMockService<CustomerService>(['searchCustomers', 'createCustomer', 'getCustomerById', 'updateCustomer']);
        const branchSpy = createMockService<BranchService>(['listBranches']);
        (branchSpy as any).listBranches.and.returnValue(of([]));
        const cashSpy = createMockService<CashService>(['listCashDrawers']);
        const stockSpy = createMockService<StockService>(['listBranchStock']);
        const employeeSpy = createMockService<EmployeeService>(['listDrivers']);
        (employeeSpy as any).listDrivers.and.returnValue(of([]));
        const vehicleSpy = createMockService<VehicleService>(['listVehicles']);
        (vehicleSpy as any).listVehicles.and.returnValue(of([]));
        const toastSpy = createMockService<ToastService>(['success', 'error', 'show']);

        TestBed.configureTestingModule({
            imports: [SalesFullComponent, ReactiveFormsModule, RouterTestingModule],
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: AuthService, useValue: authSpy },
                { provide: ProductService, useValue: productSpy },
                { provide: SaleService, useValue: saleSpy },
                { provide: CompanyService, useValue: companySpy },
                { provide: CustomerService, useValue: customerSpy },
                { provide: BranchService, useValue: branchSpy },
                { provide: CashService, useValue: cashSpy },
                { provide: StockService, useValue: stockSpy },
                { provide: EmployeeService, useValue: employeeSpy },
                { provide: VehicleService, useValue: vehicleSpy },
                { provide: ToastService, useValue: toastSpy }
            ]
        });

        const fixture = TestBed.createComponent(SalesFullComponent);
        component = fixture.componentInstance;
    });

    it('canOverridePrice should be true when user has permission', () => {
        authSpy.hasPermission.and.callFake((p: string) => p === PermissionCodes.salesPriceOverride);
        expect(component.canOverridePrice).toBeTrue();
    });

    it('canOverridePrice should be false when user lacks permission', () => {
        authSpy.hasPermission.and.returnValue(false);
        expect(component.canOverridePrice).toBeFalse();
    });

    it('setDraftItemPrice should set unitPriceOverride and recalculate total', () => {
        const item: any = { product: { id: '1' }, quantity: 3, total: 300 };
        component.setDraftItemPrice(item, 99);
        expect(item.unitPriceOverride).toBe(99);
        expect(item.total).toBe(99 * 3);
    });

    it('buildSaleRequest with permission + override should include unitPrice', () => {
        authSpy.hasPermission.and.callFake((p: string) => p === PermissionCodes.salesPriceOverride);

        (component as any).draftItems = [
            { product: { id: 'p1' }, quantity: 2, total: 100, unitPriceOverride: 50 }
        ];

        const request = (component as any).buildSaleRequest(null);
        expect(request.details[0].unitPrice).toBe(50);
    });

    it('buildSaleRequest without permission should NOT include unitPrice even with override', () => {
        authSpy.hasPermission.and.returnValue(false);

        (component as any).draftItems = [
            { product: { id: 'p1' }, quantity: 2, total: 100, unitPriceOverride: 50 }
        ];

        const request = (component as any).buildSaleRequest(null);
        expect(request.details[0].unitPrice).toBeUndefined();
    });
});
