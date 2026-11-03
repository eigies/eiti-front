import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BranchService } from '../../../core/services/branch.service';
import { CustomerService } from '../../../core/services/customer.service';
import { ReportService } from '../../../core/services/report.service';
import { PdfBrandingService } from '../../../shared/services/pdf-branding.service';
import { PdfLayoutService } from '../../../shared/services/pdf-layout.service';
import { ToastService } from '../../../shared/services/toast.service';
import { TradeInsByBranchComponent } from './trade-ins-by-branch.component';

describe('TradeInsByBranchComponent · tipo de venta', () => {
  let fixture: ComponentFixture<TradeInsByBranchComponent>;
  let reports: jasmine.SpyObj<ReportService>;

  beforeEach(() => {
    reports = jasmine.createSpyObj<ReportService>('ReportService', ['tradeInsByBranch']);
    reports.tradeInsByBranch.and.returnValue(of({
      rows: [],
      totals: { operations: 0, units: 0, amount: 0, avgUnitValue: 0 }
    }));
    TestBed.configureTestingModule({
      imports: [TradeInsByBranchComponent],
      providers: [
        { provide: ReportService, useValue: reports },
        { provide: BranchService, useValue: { listBranches: () => of([]) } },
        { provide: CustomerService, useValue: { listCustomers: () => of([]) } },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
        { provide: PdfBrandingService, useValue: {} },
        { provide: PdfLayoutService, useValue: {} }
      ]
    });
    fixture = TestBed.createComponent(TradeInsByBranchComponent);
    fixture.detectChanges();
  });

  it('arranca con todas las ventas', () => {
    expect(reports.tradeInsByBranch.calls.mostRecent().args[0].saleType).toBe('all');
  });

  it('manda el tipo de venta elegido', () => {
    fixture.componentInstance.filterForm.patchValue({ saleType: 'wholesale' });

    fixture.componentInstance.search();

    expect(reports.tradeInsByBranch.calls.mostRecent().args[0].saleType).toBe('wholesale');
  });

  it('Limpiar vuelve a todas las ventas', () => {
    fixture.componentInstance.filterForm.patchValue({ saleType: 'wholesale' });

    fixture.componentInstance.clearFilters();

    expect(reports.tradeInsByBranch.calls.mostRecent().args[0].saleType).toBe('all');
  });
});
