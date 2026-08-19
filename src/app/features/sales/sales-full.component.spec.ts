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
import { PendingTradeInService } from '../../shared/services/pending-trade-in.service';
import { PermissionCodes } from '../../core/models/permission.models';
import { of } from 'rxjs';

describe('SalesFullComponent (price override)', () => {
    let component: SalesFullComponent;
    let authSpy: jasmine.SpyObj<AuthService>;
    let pendingTradeInSpy: jasmine.SpyObj<PendingTradeInService>;

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
        pendingTradeInSpy = createMockService<PendingTradeInService>(['confirmDiscard']);
        pendingTradeInSpy.confirmDiscard.and.resolveTo(true);

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
                { provide: ToastService, useValue: toastSpy },
                { provide: PendingTradeInService, useValue: pendingTradeInSpy }
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

    // El canje a medio cargar tiene que llegar al aviso con su descripcion, no como un
    // toast generico: es el mismo aviso que el resto de las pantallas.
    it('avisa del canje incompleto antes de avanzar de paso', async () => {
        component.products = [{ id: 'p1', brand: 'MOURA', name: '12x65 20GD' } as any];
        component.paymentState.hasTradeIn = true;
        component.paymentState.tradeIns = [{ productId: 'p1', quantity: 1, amount: 0 }];

        await (component as any).validatePaymentState();

        const pending = pendingTradeInSpy.confirmDiscard.calls.mostRecent().args[0];
        expect(pending.length).toBe(1);
        expect(pending[0]).toContain('MOURA 12x65 20GD');
    });

    it('volver desde el aviso corta el guardado', async () => {
        pendingTradeInSpy.confirmDiscard.and.resolveTo(false);
        component.paymentState.hasTradeIn = true;
        component.paymentState.tradeIns = [{ productId: 'p1', quantity: 1, amount: 0 }];

        await expectAsync((component as any).validatePaymentState()).toBeResolvedTo(false);
    });

    it('continuar descarta la linea incompleta para no volver a preguntar', async () => {
        component.paymentState.hasTradeIn = true;
        component.paymentState.tradeIns = [{ productId: 'p1', quantity: 1, amount: 0 }];

        await (component as any).validatePaymentState();

        expect(component.paymentState.tradeIns).toEqual([]);
        expect(component.paymentState.hasTradeIn).toBeFalse();
    });
});
