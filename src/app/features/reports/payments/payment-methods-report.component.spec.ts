import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AssistantContextService } from '../../../core/services/assistant-context.service';
import { BranchService } from '../../../core/services/branch.service';
import { CustomerService } from '../../../core/services/customer.service';
import { ReportService } from '../../../core/services/report.service';
import { PdfBrandingService } from '../../../shared/services/pdf-branding.service';
import { PdfLayoutService } from '../../../shared/services/pdf-layout.service';
import { ToastService } from '../../../shared/services/toast.service';
import { PaymentMethodsReportComponent } from './payment-methods-report.component';

describe('PaymentMethodsReportComponent · cliente', () => {
  function render(): { fixture: ComponentFixture<PaymentMethodsReportComponent>; reports: jasmine.SpyObj<ReportService> } {
    const reports = jasmine.createSpyObj<ReportService>('ReportService', ['paymentMethods']);
    reports.paymentMethods.and.returnValue(of({ rows: [], totals: { count: 0, total: 0 } }));
    TestBed.configureTestingModule({
      imports: [PaymentMethodsReportComponent],
      providers: [
        { provide: ReportService, useValue: reports },
        { provide: BranchService, useValue: { listBranches: () => of([]) } },
        { provide: CustomerService, useValue: { listCustomers: () => of([{ id: 'c-1', fullName: 'Ana Perez' }, { id: 'c-2', fullName: 'Beto Ruiz' }]) } },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
        { provide: PdfBrandingService, useValue: {} },
        { provide: PdfLayoutService, useValue: {} },
        { provide: AssistantContextService, useValue: jasmine.createSpyObj('AssistantContextService', ['set']) }
      ]
    });
    const fixture = TestBed.createComponent(PaymentMethodsReportComponent);
    fixture.detectChanges();
    return { fixture, reports };
  }

  it('manda el cliente elegido', () => {
    const { fixture, reports } = render();
    fixture.componentInstance.filterForm.patchValue({ customerId: 'c-1' });

    fixture.componentInstance.search();

    expect(reports.paymentMethods.calls.mostRecent().args[4]).toBe('c-1');
  });

  it('el PDF dice los filtros aplicados, no los que quedaron sin aplicar', () => {
    const component = render().fixture.componentInstance;
    component.filterForm.patchValue({ customerId: 'c-1' });
    component.search();
    component.filterForm.patchValue({ customerId: 'c-2' });

    expect(component.pdfSubtitle()).toContain('Ana Perez');
    expect(component.pdfSubtitle()).not.toContain('Beto Ruiz');
  });
});
