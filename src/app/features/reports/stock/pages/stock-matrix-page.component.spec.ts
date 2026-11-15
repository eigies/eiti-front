import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { BranchResponse } from '../../../../core/models/branch.models';
import { StockMatrixResponse } from '../../../../core/models/report.models';
import { BranchService } from '../../../../core/services/branch.service';
import { ReportService } from '../../../../core/services/report.service';
import { PdfBrandingService } from '../../../../shared/services/pdf-branding.service';
import { PdfLayoutService } from '../../../../shared/services/pdf-layout.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { StockMatrixFacade } from '../data-access/stock-matrix.facade';
import { StockMatrixPageComponent } from './stock-matrix-page.component';

describe('StockMatrixPage · sucursal', () => {
  let fixture: ComponentFixture<StockMatrixPageComponent>;
  let reports: jasmine.SpyObj<ReportService>;

  function render(branches: Partial<BranchResponse>[]): void {
    reports = jasmine.createSpyObj<ReportService>('ReportService', ['stockMatrix']);
    reports.stockMatrix.and.returnValue(of({ branches: [{ id: 'b-1', name: 'Mataderos' }], rows: [] }));
    TestBed.configureTestingModule({
      imports: [StockMatrixPageComponent],
      providers: [
        { provide: ReportService, useValue: reports },
        { provide: BranchService, useValue: { listBranches: () => of(branches) } },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
        { provide: PdfBrandingService, useValue: {} },
        { provide: PdfLayoutService, useValue: {} }
      ]
    });
    fixture = TestBed.createComponent(StockMatrixPageComponent);
    fixture.detectChanges();
  }

  it('arranca con todas las sucursales', () => {
    render([]);

    expect(reports.stockMatrix).toHaveBeenCalledWith(undefined);
  });

  it('elegir una sucursal la pide al reporte', () => {
    render([]);

    fixture.componentInstance.facade.selectBranch('b-1');

    expect(reports.stockMatrix.calls.mostRecent().args[0]).toBe('b-1');
  });

  it('Actualizar mantiene la sucursal elegida', () => {
    render([]);
    fixture.componentInstance.facade.selectBranch('b-1');

    fixture.componentInstance.facade.load();

    expect(reports.stockMatrix.calls.mostRecent().args[0]).toBe('b-1');
  });

  it('quitar la sucursal vuelve a todas', () => {
    render([]);
    fixture.componentInstance.facade.selectBranch('b-1');

    fixture.componentInstance.facade.selectBranch(null);

    expect(reports.stockMatrix.calls.mostRecent().args[0]).toBeUndefined();
  });

  it('si la respuesta de otra sucursal llega tarde, no pisa la elegida', () => {
    render([]);
    const slow = new Subject<StockMatrixResponse>();
    const fast = new Subject<StockMatrixResponse>();
    reports.stockMatrix.and.returnValues(slow, fast);

    fixture.componentInstance.facade.selectBranch('b-1');
    fixture.componentInstance.facade.selectBranch('b-2');
    fast.next({ branches: [{ id: 'b-2', name: 'San Cristobal' }], rows: [] });
    slow.next({ branches: [{ id: 'b-1', name: 'Mataderos' }], rows: [] });

    expect(fixture.componentInstance.facade.data?.branches[0].id).toBe('b-2');
  });

  it('la sucursal cuenta como filtro activo', () => {
    render([]);

    fixture.componentInstance.facade.selectBranch('b-1');

    expect(fixture.componentInstance.facade.hasActiveFilters).toBeTrue();
  });

  it('ofrece el filtro cuando hay más de una sucursal', () => {
    render([{ id: 'b-1', name: 'Mataderos' }, { id: 'b-2', name: 'San Cristobal' }]);

    expect((fixture.nativeElement as HTMLElement).querySelector('app-searchable-select')).not.toBeNull();
  });
});
