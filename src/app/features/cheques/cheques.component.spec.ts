import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BankService } from '../../core/services/bank.service';
import { ChequeService } from '../../core/services/cheque.service';
import { ChequeListItem, ChequeOrigen, ChequeStatus } from '../../core/models/cheque.models';
import { ConfirmationService } from '../../shared/services/confirmation.service';
import { ToastService } from '../../shared/services/toast.service';
import { ChequesComponent } from './cheques.component';

// La pantalla muestra los cheques de terceros y los propios: un propio se reconoce y muestra su proveedor.
describe('ChequesComponent · origen', () => {
  const third: ChequeListItem = {
    id: 't1', numero: '111', bankName: 'BBVA', titular: 'Cliente SA', monto: 100, fechaVencimiento: '2026-12-01',
    estado: ChequeStatus.EnCartera, estadoName: 'EnCartera', saleCode: 'MAT-1', saleType: 'Regular',
    origen: ChequeOrigen.Tercero, supplierName: null
  };
  const own: ChequeListItem = {
    id: 'o1', numero: '222', bankName: 'Galicia', titular: 'Baterias Soler', monto: 300, fechaVencimiento: '2026-12-02',
    estado: ChequeStatus.Entregado, estadoName: 'Entregado', saleCode: null, saleType: 'Propio',
    origen: ChequeOrigen.Propio, supplierName: 'Distribuidora Norte'
  };

  let fixture: ComponentFixture<ChequesComponent>;
  let cheques: jasmine.SpyObj<ChequeService>;

  beforeEach(() => {
    cheques = jasmine.createSpyObj<ChequeService>('ChequeService', ['listCheques', 'getChequeById', 'updateChequeStatus']);
    cheques.listCheques.and.returnValue(of([third, own]));
    const banks = jasmine.createSpyObj<BankService>('BankService', ['listBanks']);
    banks.listBanks.and.returnValue(of([]));

    TestBed.configureTestingModule({
      imports: [ChequesComponent],
      providers: [
        { provide: ChequeService, useValue: cheques },
        { provide: BankService, useValue: banks },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
        { provide: ConfirmationService, useValue: jasmine.createSpyObj('ConfirmationService', ['confirm']) }
      ]
    });
    fixture = TestBed.createComponent(ChequesComponent);
    fixture.detectChanges();
  });

  it('filtra por origen', () => {
    fixture.componentInstance.filterForm.patchValue({ origen: ChequeOrigen.Propio });

    fixture.componentInstance.applyFilters();

    expect(cheques.listCheques.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ origen: ChequeOrigen.Propio }));
  });

  it('el filtro ofrece Terceros y Propios', () => {
    expect(fixture.componentInstance.origenOptions.map(o => o.label)).toEqual(['Terceros', 'Propios']);
  });

  it('un cheque propio se reconoce y muestra su proveedor', () => {
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tr.data-row'));

    expect(rows[0].textContent).toContain('Cheque recibido');
    expect(rows[1].textContent).toContain('Cheque propio');
    expect(rows[1].textContent).toContain('Distribuidora Norte');
    expect(rows[1].textContent).not.toContain('Sin venta asociada');
  });
});
