import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PermissionCodes } from '../../../../core/models/permission.models';
import { AuthService } from '../../../../core/services/auth.service';
import { PayrollDeductionConceptService } from '../../../../core/services/payroll-deduction-concept.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { DeductionConceptsFacade } from '../data-access/deduction-concepts.facade';
import { DeductionConceptsPageComponent } from './deduction-concepts-page.component';

describe('DeductionConceptsPageComponent', () => {
  let fixture: ComponentFixture<DeductionConceptsPageComponent>;
  // El estado y las reglas viven en la facade; la página solo conecta.
  let component: DeductionConceptsFacade;
  let service: jasmine.SpyObj<PayrollDeductionConceptService>;
  let auth: jasmine.SpyObj<AuthService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    service = jasmine.createSpyObj('PayrollDeductionConceptService', ['list', 'create', 'update', 'setActive']);
    auth = jasmine.createSpyObj('AuthService', ['hasPermission']);
    toast = jasmine.createSpyObj('ToastService', ['success', 'error']);
    service.list.and.returnValue(of([]));
    auth.hasPermission.and.callFake(permission => permission === PermissionCodes.payrollManage);

    await TestBed.configureTestingModule({
      imports: [DeductionConceptsPageComponent],
      providers: [
        provideRouter([]),
        { provide: PayrollDeductionConceptService, useValue: service },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DeductionConceptsPageComponent);
    component = fixture.debugElement.injector.get(DeductionConceptsFacade);
    fixture.detectChanges();
  });

  it('loads all concepts on init', () => {
    expect(service.list).toHaveBeenCalledWith(false);
  });

  it('creates a concept and reloads the list', () => {
    service.create.and.returnValue(of({ id: 'concept-1', name: 'Jubilacion', percentage: 11, isActive: true }));
    component.createForm.setValue({ name: 'Jubilacion', percentage: 11 });

    component.submitCreate();

    expect(service.create).toHaveBeenCalledWith({ name: 'Jubilacion', percentage: 11 });
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('Concepto creado');
  });
});
