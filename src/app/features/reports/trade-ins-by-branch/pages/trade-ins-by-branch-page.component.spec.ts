import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BranchService } from '../../../../core/services/branch.service';
import { CustomerService } from '../../../../core/services/customer.service';
import { ReportService } from '../../../../core/services/report.service';
import { PdfBrandingService } from '../../../../shared/services/pdf-branding.service';
import { PdfLayoutService } from '../../../../shared/services/pdf-layout.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { TradeInsByBranchFacade } from '../data-access/trade-ins-by-branch.facade';
import { TradeInsByBranchPageComponent } from './trade-ins-by-branch-page.component';

describe('TradeInsByBranchComponent · tipo de venta', () => {
  let fixture: ComponentFixture<TradeInsByBranchPageComponent>;
  let reports: jasmine.SpyObj<ReportService>;

  beforeEach(() => {
    reports = jasmine.createSpyObj<ReportService>('ReportService', ['tradeInsByBranch']);
    reports.tradeInsByBranch.and.returnValue(of({
      rows: [],
      totals: { operations: 0, units: 0, amount: 0, avgUnitValue: 0 }
    }));
    TestBed.configureTestingModule({
      imports: [TradeInsByBranchPageComponent],
      providers: [
        { provide: ReportService, useValue: reports },
        { provide: BranchService, useValue: { listBranches: () => of([{ id: 'b-1', name: 'Mataderos' }, { id: 'b-2', name: 'San Cristobal' }]) } },
        { provide: CustomerService, useValue: { listCustomers: () => of([]) } },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
        { provide: PdfBrandingService, useValue: {} },
        { provide: PdfLayoutService, useValue: {} }
      ]
    });
    fixture = TestBed.createComponent(TradeInsByBranchPageComponent);
    fixture.detectChanges();
  });

  it('arranca con todas las ventas', () => {
    expect(reports.tradeInsByBranch.calls.mostRecent().args[0].saleType).toBe('all');
  });

  it('manda el tipo de venta elegido', () => {
    fixture.componentInstance.facade.filterForm.patchValue({ saleType: 'wholesale' });

    fixture.componentInstance.facade.search();

    expect(reports.tradeInsByBranch.calls.mostRecent().args[0].saleType).toBe('wholesale');
  });

  it('el tipo de venta está dentro de Más filtros, con los otros opcionales', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.filter-form__primary app-searchable-select')).toBeNull();

    fixture.componentInstance.facade.toggleAdvancedFilters();
    fixture.detectChanges();

    expect(el.querySelector('.filter-form__advanced')?.textContent).toContain('Tipo de venta');
  });

  it('el tipo de venta cuenta como filtro activo, salvo Todas', () => {
    expect(fixture.componentInstance.facade.activeOptionalFiltersCount).toBe(0);

    fixture.componentInstance.facade.filterForm.patchValue({ saleType: 'retail' });

    expect(fixture.componentInstance.facade.activeOptionalFiltersCount).toBe(1);
  });

  it('el PDF dice los filtros aplicados, no los que quedaron sin aplicar', () => {
    const component = fixture.debugElement.injector.get(TradeInsByBranchFacade);
    component.filterForm.patchValue({ branchId: 'b-1' });
    component.search();
    component.filterForm.patchValue({ branchId: 'b-2' });

    expect(component.pdfSubtitle()).toContain('Mataderos');
    expect(component.pdfSubtitle()).not.toContain('San Cristobal');
  });

  it('Limpiar vuelve a todas las ventas', () => {
    fixture.componentInstance.facade.filterForm.patchValue({ saleType: 'wholesale' });

    fixture.componentInstance.facade.clearFilters();

    expect(reports.tradeInsByBranch.calls.mostRecent().args[0].saleType).toBe('all');
  });
});
