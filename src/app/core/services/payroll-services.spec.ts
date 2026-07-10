import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { EmployeePayrollConfigService } from './employee-payroll-config.service';
import { PayrollAdvanceService } from './payroll-advance.service';
import { PayrollDeductionConceptService } from './payroll-deduction-concept.service';
import { PayrollLiquidationService } from './payroll-liquidation.service';

describe('Payroll services', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists deduction concepts with activeOnly query param', () => {
    const service = TestBed.inject(PayrollDeductionConceptService);

    service.list(false).subscribe(result => expect(result).toEqual([]));

    const req = http.expectOne(`${environment.apiUrl}/payroll-deduction-concepts?activeOnly=false`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('creates advances and preserves cashSessionId only from request payload', () => {
    const service = TestBed.inject(PayrollAdvanceService);
    const payload = {
      employeeId: 'employee-1',
      amount: 500,
      date: '2026-07-10',
      notes: null,
      paymentMethod: 1 as const,
      cashSessionId: 'cash-session-1'
    };

    service.create(payload).subscribe(result => expect(result.id).toBe('advance-1'));

    const req = http.expectOne(`${environment.apiUrl}/payroll-advances`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({
      id: 'advance-1',
      employeeId: 'employee-1',
      amount: 500,
      date: '2026-07-10',
      notes: null,
      status: 1,
      appliedToLiquidationId: null,
      cashSessionId: 'cash-session-1'
    });
  });

  it('lists liquidations with paging and optional filters', () => {
    const service = TestBed.inject(PayrollLiquidationService);

    service.list({ employeeId: 'employee-1', periodLabel: '2026-07', status: 1, page: 2, pageSize: 20 })
      .subscribe(result => expect(result.totalCount).toBe(0));

    const req = http.expectOne(request => request.url === `${environment.apiUrl}/payroll-liquidations`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('employeeId')).toBe('employee-1');
    expect(req.request.params.get('periodLabel')).toBe('2026-07');
    expect(req.request.params.get('status')).toBe('1');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush({ items: [], page: 2, pageSize: 20, totalCount: 0, totalPages: 0 });
  });

  it('sets employee payroll config through employee endpoint', () => {
    const service = TestBed.inject(EmployeePayrollConfigService);

    service.set('employee-1', { baseSalary: 1000, payrollPeriodicity: 1 }).subscribe(result => {
      expect(result.employeeId).toBe('employee-1');
    });

    const req = http.expectOne(`${environment.apiUrl}/employees/employee-1/payroll-config`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ baseSalary: 1000, payrollPeriodicity: 1 });
    req.flush({ employeeId: 'employee-1', baseSalary: 1000, payrollPeriodicity: 1 });
  });
});
