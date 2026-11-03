import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ChequeService } from '../../../core/services/cheque.service';
import { OwnChequeDue } from '../../../core/models/cheque.models';
import { PermissionCodes } from '../../../core/models/permission.models';
import { OwnChequesDueNoticeComponent } from './own-cheques-due-notice.component';

// El aviso de los cheques propios que vencen hoy: sale la primera vez del dia que alguien con permiso
// entra a EITI, aunque la sesion haya quedado abierta de un dia para el otro.
describe('OwnChequesDueNoticeComponent', () => {
  const today = new Date().toLocaleDateString('en-CA');
  const due: OwnChequeDue[] = [
    { id: 'c1', numero: '00012345', bankName: 'BANCO GALICIA', supplierName: 'Distribuidora Norte', monto: 300000, fechaVencimiento: `${today}T00:00:00` },
    { id: 'c2', numero: '00012346', bankName: 'BANCO BBVA', supplierName: null, monto: 150000.5, fechaVencimiento: '2026-10-31T00:00:00' }
  ];

  let fixture: ComponentFixture<OwnChequesDueNoticeComponent>;
  let auth: jasmine.SpyObj<AuthService>;
  let cheques: jasmine.SpyObj<ChequeService>;
  let routerEvents: Subject<unknown>;
  let router: { events: Subject<unknown>; navigate: jasmine.Spy };

  function render(): HTMLElement {
    fixture = TestBed.createComponent(OwnChequesDueNoticeComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService',
      ['isAuthenticated', 'hasPermission', 'isDailyNoticePending', 'markDailyNoticeSeen'],
      { currentUser$: new BehaviorSubject(null) });
    auth.isAuthenticated.and.returnValue(true);
    auth.hasPermission.and.callFake((code: string) => code === PermissionCodes.chequesManage);
    auth.isDailyNoticePending.and.returnValue(true);
    cheques = jasmine.createSpyObj<ChequeService>('ChequeService', ['listOwnDue']);
    cheques.listOwnDue.and.returnValue(of(due));
    routerEvents = new Subject();
    router = { events: routerEvents, navigate: jasmine.createSpy('navigate') };

    TestBed.configureTestingModule({
      imports: [OwnChequesDueNoticeComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ChequeService, useValue: cheques },
        { provide: Router, useValue: router }
      ]
    });
  });

  it('muestra los cheques con banco, proveedor y el total', () => {
    const el = render();

    const text = el.textContent ?? '';
    expect(text).toContain('00012345');
    expect(text).toContain('BANCO GALICIA');
    expect(text).toContain('Distribuidora Norte');
    expect(text).toContain('450.000,50');
    expect(auth.markDailyNoticeSeen).toHaveBeenCalledOnceWith('own-cheques');
  });

  it('avisa la fecha de los que no vencen hoy (el lunes, los del fin de semana)', () => {
    const el = render();

    const rows = Array.from(el.querySelectorAll('.due-row'));
    expect(rows[0].textContent).not.toContain('31/10');
    expect(rows[1].textContent).toContain('31/10');
  });

  it('sin cheques que venzan no aparece nada, y no vuelve a preguntar hoy', () => {
    cheques.listOwnDue.and.returnValue(of([]));

    const el = render();

    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(auth.markDailyNoticeSeen).toHaveBeenCalledOnceWith('own-cheques');
  });

  it('sin el permiso de cheques no consulta nada', () => {
    auth.hasPermission.and.returnValue(false);

    render();

    expect(cheques.listOwnDue).not.toHaveBeenCalled();
  });

  it('si ya salió hoy no consulta de nuevo', () => {
    auth.isDailyNoticePending.and.returnValue(false);

    render();

    expect(cheques.listOwnDue).not.toHaveBeenCalled();
  });

  it('si la consulta falla no lo da por visto y reintenta al navegar', () => {
    cheques.listOwnDue.and.returnValue(throwError(() => new Error('sin conexión')));
    render();
    expect(auth.markDailyNoticeSeen).not.toHaveBeenCalled();

    cheques.listOwnDue.and.returnValue(of(due));
    routerEvents.next(new NavigationEnd(1, '/sales', '/sales'));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('00012345');
  });

  it('con la sesión abierta de ayer, sale al navegar el día siguiente', () => {
    auth.isDailyNoticePending.and.returnValue(false);
    const el = render();
    expect(el.querySelector('[role="dialog"]')).toBeNull();

    auth.isDailyNoticePending.and.returnValue(true);
    routerEvents.next(new NavigationEnd(1, '/sales', '/sales'));
    fixture.detectChanges();

    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('Entendido la cierra', () => {
    const el = render();

    (el.querySelector('.due-actions__close') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('Ver cheques lleva a la pantalla de cheques', () => {
    const el = render();

    (el.querySelector('.due-actions__go') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/cheques']);
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });
});
