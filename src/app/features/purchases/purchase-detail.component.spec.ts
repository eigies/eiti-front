import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PurchaseDetailResponse, PurchaseStatus } from '../../core/models/purchase.models';
import { PurchaseService } from '../../core/services/purchase.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';
import { PaymentReceiptPdfService } from '../../shared/services/payment-receipt-pdf.service';
import { ToastService } from '../../shared/services/toast.service';
import { PurchaseDetailComponent } from './purchase-detail.component';

// COMP-0218 (BATERIAS MATEO): nacio Pagada porque el saldo a favor se aplico solo al crearla. El boton de cancelar
// se mostraba solo en compras Pendientes, aunque el back ya cancelaba compras pagadas (preguntando que hacer con lo
// pagado): el usuario no lo encontro y la "anulo" con una nota de credito.
describe('PurchaseDetailComponent', () => {
  function purchase(status: PurchaseStatus): PurchaseDetailResponse {
    return {
      id: 'comp-0218', code: 'COMP-0218', supplierId: 'mateo', supplierName: 'BATERIAS MATEO', invoiceNumber: null,
      notes: null, ivaPct: null, ingresosBrutosPct: null, status, statusName: '', totalAmount: 231890.86, taxAmount: 0,
      grandTotal: 231890.86, totalPaid: status === PurchaseStatus.Paid ? 231890.86 : 0,
      pendingAmount: status === PurchaseStatus.Paid ? 0 : 231890.86, createdAt: '2026-11-10T12:00:00Z', paidAt: null,
      details: [], payments: []
    };
  }

  function setup(status: PurchaseStatus) {
    const purchases = jasmine.createSpyObj<PurchaseService>('PurchaseService', ['getPurchaseById', 'cancelPurchase']);
    purchases.getPurchaseById.and.returnValue(of(purchase(status)));
    const confirmation = jasmine.createSpyObj<ConfirmationService>('ConfirmationService', ['confirm']);
    confirmation.confirm.and.resolveTo(true);
    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [PurchaseDetailComponent],
      providers: [
        { provide: PurchaseService, useValue: purchases },
        { provide: ConfirmationService, useValue: confirmation },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'comp-0218' } } } },
        { provide: PaymentReceiptPdfService, useValue: jasmine.createSpyObj('PaymentReceiptPdfService', ['generateBatch']) }
      ]
    });
    const fixture = TestBed.createComponent(PurchaseDetailComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, purchases, confirmation, toast };
  }

  function cancelButton(element: HTMLElement): HTMLButtonElement | null {
    return Array.from(element.querySelectorAll<HTMLButtonElement>('button.btn-danger'))
      .find(button => button.textContent?.includes('Cancelar compra')) ?? null;
  }

  it('una compra pagada se puede cancelar', () => {
    const { fixture } = setup(PurchaseStatus.Paid);
    expect(cancelButton(fixture.nativeElement)).not.toBeNull();
  });

  it('una compra cancelada no muestra el boton', () => {
    const { fixture } = setup(PurchaseStatus.Cancelled);
    expect(cancelButton(fixture.nativeElement)).toBeNull();
  });

  it('con una compra pagada, el modal pregunta que hacer con lo pagado', () => {
    const { fixture } = setup(PurchaseStatus.Paid);
    cancelButton(fixture.nativeElement)!.click();
    fixture.detectChanges();

    const options = (fixture.nativeElement as HTMLElement).querySelectorAll('.pcancel-opt');
    expect(options.length).toBe(2);
  });

  it('con una nota de credito vigente, muestra cual se anula y reenvia confirmando con el mismo modo', async () => {
    const { component, purchases, confirmation } = setup(PurchaseStatus.Paid);
    const detail = 'La compra tiene vigente la nota de crédito NCP-002 por $ 231.890,86. Si confirmás, se anula junto con la compra.';
    purchases.cancelPurchase.and.returnValues(
      throwError(() => ({ error: { errorCode: 'Purchases.Cancel.HasActiveCreditNote', detail } })),
      of(void 0));

    component.openCancelModal();
    component.setCancelRefundMode(1);
    component.confirmCancelPurchase();
    await new Promise(resolve => setTimeout(resolve));

    const options = confirmation.confirm.calls.mostRecent().args[0];
    expect(options.message).toBe(detail);
    expect(options.confirmLabel).toBe('Cancelar la compra y sus notas de crédito');
    expect(purchases.cancelPurchase.calls.allArgs()).toEqual([
      ['comp-0218', 1, false],
      ['comp-0218', 1, true]
    ]);
  });

  it('si el usuario vuelve, no se cancela nada', async () => {
    const { component, purchases, confirmation, toast } = setup(PurchaseStatus.Paid);
    confirmation.confirm.and.resolveTo(false);
    purchases.cancelPurchase.and.returnValue(
      throwError(() => ({ error: { errorCode: 'Purchases.Cancel.HasActiveCreditNote', detail: 'NCP-002' } })));

    component.openCancelModal();
    component.confirmCancelPurchase();
    await new Promise(resolve => setTimeout(resolve));

    expect(purchases.cancelPurchase).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
