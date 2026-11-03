import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BranchResponse } from '../../../core/models/branch.models';
import { BranchService } from '../../../core/services/branch.service';
import { ReportService } from '../../../core/services/report.service';
import { ToastService } from '../../../shared/services/toast.service';
import { CashReportComponent } from './cash-report.component';

describe('CashReportComponent · sucursal', () => {
  let fixture: ComponentFixture<CashReportComponent>;
  let reports: jasmine.SpyObj<ReportService>;

  function render(branches: Partial<BranchResponse>[]): void {
    reports = jasmine.createSpyObj<ReportService>('ReportService', ['cashMovements']);
    reports.cashMovements.and.returnValue(of({ categories: [], totalGeneral: 0 }));
    TestBed.configureTestingModule({
      imports: [CashReportComponent],
      providers: [
        { provide: ReportService, useValue: reports },
        { provide: BranchService, useValue: { listBranches: () => of(branches) } },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) }
      ]
    });
    fixture = TestBed.createComponent(CashReportComponent);
    fixture.detectChanges();
  }

  it('sin elegir sucursal pide todas', () => {
    render([]);

    expect(reports.cashMovements.calls.mostRecent().args[2]).toBeUndefined();
  });

  it('manda la sucursal elegida', () => {
    render([]);
    fixture.componentInstance.filterForm.patchValue({ branchId: 'b-1' });

    fixture.componentInstance.search();

    expect(reports.cashMovements.calls.mostRecent().args[2]).toBe('b-1');
  });

  it('ofrece el filtro cuando hay más de una sucursal', () => {
    render([{ id: 'b-1', name: 'Mataderos' }, { id: 'b-2', name: 'San Cristobal' }]);

    expect((fixture.nativeElement as HTMLElement).querySelector('form app-searchable-select')).not.toBeNull();
  });

  it('con una sola sucursal no ofrece el filtro', () => {
    render([{ id: 'b-1', name: 'Mataderos' }]);

    expect((fixture.nativeElement as HTMLElement).querySelector('form app-searchable-select')).toBeNull();
  });
});
