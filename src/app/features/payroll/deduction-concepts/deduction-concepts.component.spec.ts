import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PermissionCodes } from '../../../core/models/permission.models';
import { AuthService } from '../../../core/services/auth.service';
import { PayrollDeductionConceptService } from '../../../core/services/payroll-deduction-concept.service';
import { ToastService } from '../../../shared/services/toast.service';
import { DeductionConceptsComponent } from './deduction-concepts.component';

describe('DeductionConceptsComponent', () => {
  let fixture: ComponentFixture<DeductionConceptsComponent>;
  let component: DeductionConceptsComponent;
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
      imports: [DeductionConceptsComponent],
      providers: [
        { provide: PayrollDeductionConceptService, useValue: service },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DeductionConceptsComponent);
    component = fixture.componentInstance;
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
