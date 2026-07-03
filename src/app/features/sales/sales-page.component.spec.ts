import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SalesPageComponent } from './sales-page.component';
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
import { OnboardingService } from '../../core/services/onboarding.service';
import { PermissionCodes } from '../../core/models/permission.models';
import { of } from 'rxjs';

describe('SalesPageComponent (price override)', () => {
    let component: SalesPageComponent;
    let fixture: ComponentFixture<SalesPageComponent>;
    let authSpy: jasmine.SpyObj<AuthService>;
    let saleSpy: jasmine.SpyObj<SaleService>;

    function createMockService<T>(methods: string[]): jasmine.SpyObj<T> {
        return jasmine.createSpyObj(methods) as jasmine.SpyObj<T>;
    }

    beforeEach(() => {
        authSpy = jasmine.createSpyObj('AuthService', ['hasPermission', 'getToken', 'isAuthenticated'], { currentUser$: of(null), currentUser: null });
        const productSpy = createMockService<ProductService>(['listProducts']);
        (productSpy as any).listProducts.and.returnValue(of([]));
        saleSpy = createMockService<SaleService>(['listSales', 'createSale']);
        (saleSpy as any).listSales.and.returnValue(of([]));
        (saleSpy as any).createSale.and.returnValue(of({}));
        const companySpy = createMockService<CompanyService>(['getCurrentCompany']);
        (companySpy as any).getCurrentCompany.and.returnValue(of({}));
        const customerSpy = createMockService<CustomerService>(['searchCustomers']);
        const branchSpy = createMockService<BranchService>(['listBranches']);
        (branchSpy as any).listBranches.and.returnValue(of([]));
        const cashSpy = createMockService<CashService>(['listCashDrawers']);
        (cashSpy as any).listCashDrawers.and.returnValue(of([]));
        const stockSpy = createMockService<StockService>(['listBranchStock']);
        (stockSpy as any).listBranchStock.and.returnValue(of([]));
        const employeeSpy = createMockService<EmployeeService>(['listDrivers']);
        (employeeSpy as any).listDrivers.and.returnValue(of([]));
        const vehicleSpy = createMockService<VehicleService>(['listVehicles']);
        (vehicleSpy as any).listVehicles.and.returnValue(of([]));
        const toastSpy = createMockService<ToastService>(['success', 'error', 'show']);
        const onboardingSpy = createMockService<OnboardingService>(['getStatus', 'reset', 'consumeCompletionNotice']);
        (onboardingSpy as any).getStatus.and.returnValue(of(null));
        (onboardingSpy as any).consumeCompletionNotice.and.returnValue(false);

        TestBed.configureTestingModule({
            imports: [SalesPageComponent, ReactiveFormsModule, RouterTestingModule],
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
                { provide: OnboardingService, useValue: onboardingSpy }
            ]
        });

        fixture = TestBed.createComponent(SalesPageComponent);
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

    it('buildRequest with permission + override should include unitPrice', () => {
        authSpy.hasPermission.and.callFake((p: string) => p === PermissionCodes.salesPriceOverride);

        (component as any).draftItems = [
            { product: { id: 'p1' }, quantity: 2, total: 100, unitPriceOverride: 50 }
        ];

        const request = (component as any).buildRequest(
            (component as any).lineForm,
            (component as any).draftItems,
            (component as any).createPaymentState,
            null,
            0
        );

        expect(request.details[0].unitPrice).toBe(50);
    });

    it('buildRequest without permission should NOT include unitPrice even with override', () => {
        authSpy.hasPermission.and.returnValue(false);

        (component as any).draftItems = [
            { product: { id: 'p1' }, quantity: 2, total: 100, unitPriceOverride: 50 }
        ];

        const request = (component as any).buildRequest(
            (component as any).lineForm,
            (component as any).draftItems,
            (component as any).createPaymentState,
            null,
            0
        );

        expect(request.details[0].unitPrice).toBeUndefined();
    });

    it('starts in sell mode and configuration stage', () => {
        expect(component.activeMode).toBe('sell');
        expect(component.activeCreateStage).toBe('config');
    });

    it('switches modes without resetting draft or filters', () => {
        component.draftItems = [{ product: { id: 'p1' } as any, quantity: 1, total: 100 }];
        component.filterForm.patchValue({ code: 'V-42' });

        component.setActiveMode('manage');
        component.setActiveMode('sell');

        expect(component.draftItems.length).toBe(1);
        expect(component.filterForm.get('code')?.value).toBe('V-42');
    });

    it('maps draft products to summary preview items', () => {
        component.draftItems = [{
            product: { id: 'p1', brand: 'Moura', name: 'M20GD' } as any,
            quantity: 2,
            total: 104000
        }];

        expect(component.quickSaleSummaryItems).toEqual([{
            id: 'p1',
            label: 'Moura / M20GD',
            quantity: 2,
            subtotal: 104000
        }]);
    });

    it('moves to the first invalid stage before creating a sale', () => {
        component.activeCreateStage = 'payment';
        component.lineForm.patchValue({ branchId: '', sourceChannel: null });

        component.createSale();

        expect(component.activeCreateStage).toBe('config');
    });

    it('advances the quick-sale primary action through the stages', () => {
        component.activeCreateStage = 'config';

        component.handleQuickSalePrimaryAction();
        expect(component.activeCreateStage).toBe('products');

        component.handleQuickSalePrimaryAction();
        expect(component.activeCreateStage).toBe('payment');
    });

    it('dispatches semantic sale actions to the existing handlers', () => {
        const sale = { id: 'sale-1' } as any;
        spyOn(component, 'beginEdit');

        component.handleSaleUiAction(sale, 'edit');

        expect(component.beginEdit).toHaveBeenCalledWith(sale);
    });

    it('exposes accessible mode tabs', () => {
        fixture.detectChanges();

        const tabs = fixture.nativeElement.querySelectorAll('.sales-mode-tabs [role="tab"]');
        expect(tabs.length).toBe(2);
        expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    });

    it('marks the invalid channel control for assistive technology', () => {
        component.activeCreateStage = 'payment';
        component.lineForm.patchValue({ branchId: '', sourceChannel: null });

        component.createSale();
        fixture.detectChanges();

        expect(component.activeCreateStage).toBe('config');
        expect(fixture.nativeElement.querySelector('.ch-sel__trigger[aria-invalid="true"]')).not.toBeNull();
    });

    it('detects active optional sales filters', () => {
        expect(component.hasActiveOptionalSaleFilters).toBeFalse();

        component.filterForm.patchValue({ code: 'V-42' });

        expect(component.hasActiveOptionalSaleFilters).toBeTrue();
    });

    it('renders stable loading rows while sales are loading', () => {
        fixture.detectChanges();
        component.loadingSales = true;

        fixture.detectChanges();

        expect(fixture.nativeElement.querySelectorAll('.sales-skeleton__row').length).toBe(4);
    });

    it('returns to the configuration stage after creating a sale', () => {
        component.activeCreateStage = 'payment';
        component.lineForm.patchValue({ branchId: 'branch-1', sourceChannel: 1 });
        component.draftItems = [{
            product: { id: 'p1', price: 100, publicPrice: 100 } as any,
            quantity: 1,
            total: 100
        }];

        component.createSale();

        expect(saleSpy.createSale).toHaveBeenCalled();
        expect(component.activeCreateStage).toBe('config');
    });

    it('uses plain channel labels without legacy emoji', () => {
        component.lineForm.patchValue({ sourceChannel: 2 });
        const sale = { sourceChannel: 2 } as any;

        expect(component.createChannelLabel).toBe('WhatsApp');
        expect(component.saleChannelLabel(sale)).toBe('WhatsApp');
    });
});
