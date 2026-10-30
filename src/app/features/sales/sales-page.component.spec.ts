import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
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
import { ConfirmationService } from '../../shared/services/confirmation.service';
import { SaleFiscalPdfService } from '../../shared/services/sale-fiscal-pdf.service';
import { CreateSaleRequest, SaleFiscalReceiversResponse, SaleResponse } from '../../core/models/sale.models';
import { ProductResponse } from '../../core/models/product.models';
import { of, throwError } from 'rxjs';

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
        saleSpy = createMockService<SaleService>(['listSales', 'createSale', 'updateSale', 'cancelSale', 'getFiscalReceivers']);
        (saleSpy as any).listSales.and.returnValue(of([]));
        (saleSpy as any).createSale.and.returnValue(of({}));
        saleSpy.updateSale.and.returnValue(of({} as SaleResponse));
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

    it('buildRequest manda las observaciones recortadas, o null si están vacías', () => {
        (component as any).draftItems = [{ product: { id: 'p1' }, quantity: 1, total: 100 }];
        const build = () => (component as any).buildRequest(
            (component as any).lineForm, (component as any).draftItems, (component as any).createPaymentState, null, 0);

        component.lineForm.patchValue({ notes: '  Presup. 1234 - Patente AB123CD  ' });
        expect(build().notes).toBe('Presup. 1234 - Patente AB123CD');

        component.lineForm.patchValue({ notes: '   ' });
        expect(build().notes).toBeNull();
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

    it('focuses the product draft when remaining products are requested from the products stage', fakeAsync(() => {
        component.activeCreateStage = 'products';
        fixture.detectChanges();
        const productDraft = fixture.nativeElement.querySelector('.quick-sale-draft');
        spyOn(productDraft, 'focus');
        spyOn(productDraft, 'scrollIntoView');

        component.handleSummaryProductsRequested();
        tick();

        expect(component.activeCreateStage).toBe('products');
        expect(productDraft.focus).toHaveBeenCalled();
        expect(productDraft.scrollIntoView).toHaveBeenCalled();
    }));

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

    it('returns to the configuration stage after creating a sale', async () => {
        component.activeCreateStage = 'payment';
        component.lineForm.patchValue({ branchId: 'branch-1', sourceChannel: 1 });
        component.draftItems = [{
            product: { id: 'p1', price: 100, publicPrice: 100 } as any,
            quantity: 1,
            total: 100
        }];

        await component.createSale();

        expect(saleSpy.createSale).toHaveBeenCalled();
        expect(component.activeCreateStage).toBe('config');
    });

    it('uses plain channel labels without legacy emoji', () => {
        component.lineForm.patchValue({ sourceChannel: 2 });
        const sale = { sourceChannel: 2 } as any;

        expect(component.createChannelLabel).toBe('WhatsApp');
        expect(component.saleChannelLabel(sale)).toBe('WhatsApp');
    });

    it('shows one amount line per method for combined payments', () => {
        fixture.detectChanges();
        component.activeMode = 'manage';
        component.loadingSales = false;
        component.sales = [{
            id: 'sale-combined',
            code: 'SUCU-123-144',
            branchId: 'branch-1',
            customerFullName: 'Consumidor final',
            hasDelivery: false,
            idSaleStatus: 2,
            saleStatus: 'Pagada',
            totalAmount: 99000,
            createdAt: '2026-07-05T12:13:00Z',
            isModified: false,
            isCuentaCorriente: false,
            payments: [
                { idPaymentMethod: 1, paymentMethodName: 'Efectivo', amount: 49000 },
                { idPaymentMethod: 2, paymentMethodName: 'Transferencia', amount: 50000 }
            ],
            tradeIns: [],
            details: [{ productId: 'p1', productName: 'Producto', productBrand: 'Marca', quantity: 1, unitPrice: 99000, totalAmount: 99000, discountPercent: 0 }]
        }];

        fixture.detectChanges();

        const badge = fixture.nativeElement.querySelector('.sale-card__payment--combined');
        const lines = Array.from(
            fixture.nativeElement.querySelectorAll('.sale-card__payment-line')
        ).map((line: any) => line.textContent.replace(/\s+/g, ' ').trim());

        expect(badge).not.toBeNull();
        expect(lines).toEqual([
            'Efectivo·$49.000',
            'Transferencia·$50.000'
        ]);
        const method = badge.querySelector('.sale-card__payment-method') as HTMLElement;
        const amount = badge.querySelector('.sale-card__payment-amount') as HTMLElement;
        expect(method).not.toBeNull();
        expect(amount).not.toBeNull();
        if (!method || !amount) {
            return;
        }
        expect(parseFloat(getComputedStyle(amount).fontSize))
            .toBeGreaterThan(parseFloat(getComputedStyle(method).fontSize));
        expect(parseInt(getComputedStyle(amount).fontWeight, 10)).toBeGreaterThanOrEqual(600);
        expect(getComputedStyle(badge.querySelector('svg')).display).toBe('none');
        for (const line of Array.from(badge.querySelectorAll('.sale-card__payment-line')) as HTMLElement[]) {
            expect(getComputedStyle(line).whiteSpace).toBe('nowrap');
        }
        expect(badge.scrollWidth).toBeLessThanOrEqual(badge.clientWidth);
    });

    it('explica en castellano que una venta facturada no puede cambiar de importe', () => {
        const toast = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;

        (component as any).handleSaleChargeError({
            error: {
                errorCode: 'Sales.Update.InvoicedAmountChange',
                detail: 'The sale is already invoiced: void the invoice with a credit note before changing its amount.'
            }
        }, 'No se pudo actualizar la venta');

        expect(toast.error).toHaveBeenCalledWith(
            'La venta ya está facturada: para cambiar el importe, primero anulá la factura con una nota de crédito.');
    });

    describe('alta rápida de cliente: datos de facturación', () => {
        beforeEach(() => {
            authSpy.hasPermission.and.returnValue(false);
            (component as any).companyAutomaticInvoicing = false;
        });

        it('si la venta no se factura arrancan cerrados y se pueden abrir', () => {
            component.openQuickCreateCustomer();
            expect(component.quickCreateShowsBilling).toBeFalse();

            component.quickCreateBillingOpen = true;

            expect(component.quickCreateShowsBilling).toBeTrue();
        });

        it('sin facturar el CUIT es opcional, pero si se carga tiene que ser válido', () => {
            component.openQuickCreateCustomer();
            component.quickCreateBillingOpen = true;
            component.quickCreateCustomerName = 'Juan Perez';

            expect(component.quickCreateBillingIssue).toBeNull();
            component.quickCreateCustomerTaxId = '20-39758385-8';
            expect(component.quickCreateBillingIssue).toContain('CUIT no es válido');
            component.quickCreateCustomerTaxId = '20-39758385-7';
            expect(component.quickCreateBillingIssue).toBeNull();
        });

        it('al crear manda CUIT y condición solo si se abrieron los datos', () => {
            const customers = TestBed.inject(CustomerService) as any;
            customers.createCustomer = jasmine.createSpy('createCustomer').and.returnValue(of({ id: 'c1', name: 'Juan Perez', fullName: 'Juan Perez' }));

            component.openQuickCreateCustomer();
            component.quickCreateCustomerName = 'Juan Perez';
            component.quickCreateCustomerTaxId = '20-39758385-7';
            component.quickCreateCustomerIvaCondition = 1;
            component.submitQuickCreateCustomer();
            expect(customers.createCustomer.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ taxId: null, ivaCondition: null }));

            component.openQuickCreateCustomer();
            component.quickCreateBillingOpen = true;
            component.quickCreateCustomerName = 'Juan Perez';
            component.quickCreateCustomerTaxId = '20-39758385-7';
            component.quickCreateCustomerIvaCondition = 1;
            component.submitQuickCreateCustomer();
            expect(customers.createCustomer.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ taxId: '20-39758385-7', ivaCondition: 1 }));
        });
    });

    // MAT-3705: la factura salio a un CUIT, la ficha cambio y la NC salio al otro sin que nadie lo viera.
    // Ahora el back frena la anulacion y el usuario ve los dos CUIT antes de emitir la NC.
    describe('anular una venta facturada a otro CUIT que el de la ficha', () => {
        const sale = { id: 'sale-1', code: 'MAT-3705', idSaleStatus: 2, invoicingStatus: 3 } as SaleResponse;
        const receivers: SaleFiscalReceiversResponse = {
            available: true,
            unavailableReason: null,
            invoice: { document: 'Factura A 00010-00000039', name: 'TRANSPORTE OLIVOS S.A -', vatCondition: 'IVA Responsable Inscripto', identification: 'CUIT: 30-68225650-4' },
            customer: { document: null, name: 'TRANSPORTE OLIVOS S.A -', vatCondition: 'IVA Responsable Inscripto', identification: 'CUIT: 30-51743143-1' },
            customerMatchesInvoice: false,
            creditNote: null,
            creditNoteMatchesInvoice: true,
            regularizationStep: 'none',
            debitNote: null
        };

        it('muestra los dos CUIT y reenvia confirmando que la NC vaya al de la factura', async () => {
            const confirm = spyOn(TestBed.inject(ConfirmationService), 'confirm').and.resolveTo(true);
            (saleSpy as any).cancelSale.and.returnValues(
                throwError(() => ({ error: { errorCode: 'Sales.Cancel.InvoiceReceiverChanged', detail: 'La factura se emitió a otro receptor.' } })),
                of(void 0));
            (saleSpy as any).getFiscalReceivers.and.returnValue(of(receivers));
            component.cancelSaleModal = sale;

            component.confirmCancelSale();
            await new Promise(resolve => setTimeout(resolve));

            const options = confirm.calls.mostRecent().args[0];
            expect(options.comparison?.primary.identification).toBe('CUIT: 30-68225650-4');
            expect(options.comparison?.secondary.identification).toBe('CUIT: 30-51743143-1');
            expect(options.confirmLabel?.replace(/⁠/g, '')).toBe('Anular y emitir la NC a CUIT 30-68225650-4');
            expect((saleSpy as any).cancelSale.calls.allArgs()).toEqual([
                ['sale-1', undefined, false],
                ['sale-1', undefined, true]
            ]);
        });

        it('si el usuario vuelve, no se anula nada', async () => {
            spyOn(TestBed.inject(ConfirmationService), 'confirm').and.resolveTo(false);
            (saleSpy as any).cancelSale.and.returnValue(
                throwError(() => ({ error: { errorCode: 'Sales.Cancel.InvoiceReceiverChanged' } })));
            (saleSpy as any).getFiscalReceivers.and.returnValue(of(receivers));
            component.cancelSaleModal = sale;

            component.confirmCancelSale();
            await new Promise(resolve => setTimeout(resolve));

            expect((saleSpy as any).cancelSale).toHaveBeenCalledTimes(1);
        });

        it('sin el servicio fiscal no pregunta a ciegas: avisa', async () => {
            const confirm = spyOn(TestBed.inject(ConfirmationService), 'confirm');
            const toast = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;
            (saleSpy as any).cancelSale.and.returnValue(
                throwError(() => ({ error: { errorCode: 'Sales.Cancel.InvoiceReceiverChanged' } })));
            (saleSpy as any).getFiscalReceivers.and.returnValue(of({ ...receivers, available: false, invoice: null,
                unavailableReason: 'No se pudo consultar al servicio de facturación a quién se emitió el comprobante.' }));
            component.cancelSaleModal = sale;

            component.confirmCancelSale();
            await new Promise(resolve => setTimeout(resolve));

            expect(confirm).not.toHaveBeenCalled();
            expect(toast.error).toHaveBeenCalledWith('No se pudo consultar al servicio de facturación a quién se emitió el comprobante.');
        });
    });

    describe('descarga de comprobantes fiscales', () => {
        const sale = { id: 'sale-1', code: 'MAT-3705', idSaleStatus: 2, invoicingStatus: 5 } as SaleResponse;

        it('cada comprobante se baja por el servicio compartido', () => {
            const download = spyOn(TestBed.inject(SaleFiscalPdfService), 'download');

            component.downloadInvoicePdf(sale);
            component.downloadCreditNotePdf(sale);
            component.downloadDebitNotePdf(sale);

            expect(download.calls.allArgs()).toEqual([
                ['sale-1', 'invoice'],
                ['sale-1', 'creditNote'],
                ['sale-1', 'debitNote']
            ]);
        });
    });

    describe('descuento minorista', () => {
        const moura = { id: 'p1', code: 'M20', brand: 'Moura', name: 'M20GD', price: 1000, publicPrice: 1000 } as ProductResponse;

        // Venta en espera con 15% de descuento: el dueño despues bajo el tope a 10%.
        const discountedSale = {
            id: 'sale-15',
            code: 'MAT-4001',
            branchId: 'branch-1',
            customerId: null,
            hasDelivery: false,
            idSaleStatus: 1,
            saleStatus: 'En espera',
            totalAmount: 850,
            pendingAmount: 850,
            createdAt: '2026-10-30T12:00:00Z',
            isModified: false,
            isCuentaCorriente: false,
            sourceChannel: 1,
            generalDiscountPercent: 15,
            generalDiscountReason: 'Cliente frecuente',
            payments: [],
            tradeIns: [],
            details: [{ productId: 'p1', productName: 'M20GD', productBrand: 'Moura', quantity: 1, unitPrice: 1000, totalAmount: 1000, discountPercent: 0 }]
        } as SaleResponse;

        function buildCreateRequest(): CreateSaleRequest {
            return component['buildRequest'](component.lineForm, component.draftItems, component.createPaymentState, null, 0);
        }

        function readyToCreate(status: number): void {
            component.maxRetailDiscountPercent = 10;
            component.lineForm.patchValue({ branchId: 'branch-1', sourceChannel: 1, idSaleStatus: status });
            component.draftItems = [{ product: moura, quantity: 1, total: 1000 }];
        }

        it('el total ya trae el descuento: (renglones + recargo sin envío) × (1 − %)', () => {
            component.defaultNoDeliverySurcharge = 100;
            component.draftItems = [{ product: moura, quantity: 1, total: 1000 }];
            component.createDiscount = { open: true, percent: 10, reason: '' };

            expect(component.draftTotal).toBe(990);

            component.defaultNoDeliverySurcharge = 0;
            component.draftItems = [{ product: moura, quantity: 1, total: 333.33 }];
            component.createDiscount = { open: true, percent: 12.5, reason: '' };

            expect(component.draftTotal).toBe(291.66);
        });

        it('el request lleva el % y el motivo recortado; sin descuento, 0 y sin motivo', () => {
            component.draftItems = [{ product: moura, quantity: 1, total: 1000 }];
            component.createDiscount = { open: true, percent: 10, reason: '  Cliente frecuente  ' };

            expect(buildCreateRequest()).toEqual(jasmine.objectContaining({ generalDiscountPercent: 10, generalDiscountReason: 'Cliente frecuente' }));

            component.createDiscount = { open: true, percent: 0, reason: 'quedó escrito' };

            expect(buildCreateRequest()).toEqual(jasmine.objectContaining({ generalDiscountPercent: 0, generalDiscountReason: null }));
        });

        it('una venta pagada con descuento se cobra por el total descontado', async () => {
            readyToCreate(2);
            component.createDiscount = { open: true, percent: 10, reason: '' };
            component.createPaymentState.payments[0].amount = 900;

            await component.createSale();

            expect(saleSpy.createSale).toHaveBeenCalled();
        });

        it('un descuento por encima del tope no se manda', async () => {
            const toast = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;
            readyToCreate(1);
            component.createDiscount = { open: true, percent: 15, reason: '' };

            await component.createSale();

            expect(saleSpy.createSale).not.toHaveBeenCalled();
            expect(toast.error).toHaveBeenCalledWith('El descuento supera el máximo de 10% que fijó el dueño.');
        });

        it('si el back rechaza el descuento muestra su mensaje', async () => {
            const toast = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;
            saleSpy.createSale.and.returnValue(throwError(() => ({ error: {
                errorCode: 'Sales.Discount.ExceedsLimit', detail: 'El descuento supera el máximo de 10% que fijó el dueño.' } })));
            readyToCreate(1);
            component.createDiscount = { open: true, percent: 10, reason: '' };

            await component.createSale();

            expect(toast.error).toHaveBeenCalledWith('El descuento supera el máximo de 10% que fijó el dueño.');
        });

        it('al editar trae el descuento de la venta y el total lo aplica', () => {
            component.products = [moura];

            component.beginEdit(discountedSale);

            expect(component.editDiscount).toEqual({ open: true, percent: 15, reason: 'Cliente frecuente' });
            expect(component.editTotal).toBe(850);
            const request = component['buildRequest'](component.editMetaForm, component.editItems, component.editPaymentState, null, 0);
            expect(request).toEqual(jasmine.objectContaining({ generalDiscountPercent: 15, generalDiscountReason: 'Cliente frecuente' }));
        });

        it('editar sin tocar un descuento que quedó arriba del tope nuevo se guarda igual', async () => {
            component.products = [moura];
            component.maxRetailDiscountPercent = 10;
            component.beginEdit(discountedSale);

            await component.saveEdit();

            expect(saleSpy.updateSale).toHaveBeenCalledWith('sale-15', jasmine.objectContaining({ generalDiscountPercent: 15 }));
        });

        it('cambiar el descuento al editar sí respeta el tope', async () => {
            component.products = [moura];
            component.maxRetailDiscountPercent = 10;
            component.beginEdit(discountedSale);
            component.editDiscount = { ...component.editDiscount, percent: 12 };

            await component.saveEdit();

            expect(saleSpy.updateSale).not.toHaveBeenCalled();
        });

        it('el "Cobrar" rápido conserva el descuento y el motivo de la venta', () => {
            (TestBed.inject(CashService) as jasmine.SpyObj<CashService>).listCashDrawers.and.returnValue(of([
                { id: 'drawer-1', branchId: 'branch-1', name: 'Caja 1', isActive: true, hasOpenSession: true, createdAt: '2026-10-30T00:00:00Z' }
            ]));

            component.markAsPaid(discountedSale);

            expect(saleSpy.updateSale).toHaveBeenCalledWith('sale-15', jasmine.objectContaining({
                generalDiscountPercent: 15,
                generalDiscountReason: 'Cliente frecuente',
                payments: [jasmine.objectContaining({ idPaymentMethod: 1, amount: 850 })]
            }));
        });

        it('cambiar el canal de una venta no le borra el descuento', () => {
            component.openChannelPopup(discountedSale);
            component.selectChannelInPopup(2);

            component.saveChannelPopup();

            expect(saleSpy.updateSale).toHaveBeenCalledWith('sale-15', jasmine.objectContaining({
                generalDiscountPercent: 15,
                generalDiscountReason: 'Cliente frecuente'
            }));
        });

        it('con tope 0 el control no aparece; con tope muestra "hasta X%"', () => {
            component.activeCreateStage = 'payment';
            fixture.detectChanges();

            expect(fixture.nativeElement.querySelector('app-sale-discount-control')).toBeNull();

            component.maxRetailDiscountPercent = 10;
            fixture.detectChanges();

            const control = fixture.nativeElement.querySelector('app-sale-discount-control') as HTMLElement | null;
            expect(control).not.toBeNull();
            expect(control?.textContent).toContain('hasta 10%');
        });

        it('toma el tope de la empresa', () => {
            (TestBed.inject(CompanyService) as jasmine.SpyObj<CompanyService>).getCurrentCompany.and.returnValue(of({
                id: 'co-1', name: 'Soler', primaryDomain: 'soler.com', maxRetailDiscountPercent: 8, createdAt: '2026-01-01T00:00:00Z'
            }));

            fixture.detectChanges();

            expect(component.maxRetailDiscountPercent).toBe(8);
        });
    });
});
