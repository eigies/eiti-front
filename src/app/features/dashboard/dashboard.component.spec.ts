import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { of, Subject, throwError } from 'rxjs';
import { PermissionCodes } from '../../core/models/permission.models';
import { DashboardSummaryResponse } from '../../core/models/dashboard.models';
import { AuthService } from '../../core/services/auth.service';
import { BranchService } from '../../core/services/branch.service';
import { DashboardPreferencesService } from '../../core/services/dashboard-preferences.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { ProductCategoryService } from '../../core/services/product-category.service';
import { ToastService } from '../../shared/services/toast.service';
import { SearchableSelectComponent } from '../../shared/components/searchable-select/searchable-select.component';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  const summary: DashboardSummaryResponse = {
    month: {
      total: { count: 3, units: 3, amount: 300 },
      retail: { count: 2, units: 2, amount: 200 },
      currentAccount: { count: 1, units: 1, amount: 100 }
    },
    today: {
      total: { count: 1, units: 1, amount: 100 },
      retail: { count: 1, units: 1, amount: 100 },
      currentAccount: { count: 0, units: 0, amount: 0 }
    },
    days: [],
    topProducts: [],
    collections: { paidAmount: 200, paidCount: 2, pendingAmount: 100, pendingCount: 1, avgTicket: 100 },
    todayStatus: { activeCount: 1, paidCount: 1, pendingCount: 0, cancelledCount: 0 },
    recentSales: []
  };

  function setup(
    branchesFail = false,
    canViewFinancials = true,
    canViewAllBranches: boolean | null = true
  ) {
    const auth = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['hasPermission'],
      {
        currentUser: {
          userId: 'user-a',
          username: 'agus',
          email: 'agus@example.com',
          token: 'token',
          refreshToken: 'refresh',
          permissions: [],
          canViewAllBranches: canViewAllBranches ?? undefined
        }
      }
    );
    auth.hasPermission.and.callFake((permission: string) =>
      permission === PermissionCodes.dashboardViewFinancials ? canViewFinancials : true
    );
    const dashboard = jasmine.createSpyObj<DashboardService>('DashboardService', ['getSummary', 'listSales']);
    dashboard.getSummary.and.returnValue(of(summary));
    dashboard.listSales.and.returnValue(of([]));
    const prefs = jasmine.createSpyObj<DashboardPreferencesService>(
      'DashboardPreferencesService',
      ['readBranchId', 'writeBranchId', 'readChartSegment', 'writeChartSegment',
       'readChartMetric', 'writeChartMetric', 'readCategoryIds', 'writeCategoryIds']
    );
    prefs.readBranchId.and.returnValue('branch-a');
    prefs.readChartSegment.and.returnValue('cc');
    prefs.readChartMetric.and.returnValue('count');
    prefs.readCategoryIds.and.returnValue([]);
    const branch = jasmine.createSpyObj<BranchService>('BranchService', ['listBranches']);
    branch.listBranches.and.returnValue(branchesFail
      ? throwError(() => new Error('branches unavailable'))
      : of([{ id: 'branch-a', name: 'Centro', salesCount: 0, cashValue: 0, createdAt: '' }]));
    const categories = jasmine.createSpyObj<ProductCategoryService>('ProductCategoryService', ['list']);
    categories.list.and.returnValue(of([]));
    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['error']);
    const component = new DashboardComponent(auth, dashboard, prefs, branch, categories, toast);

    return { component, auth, dashboard, prefs, branch, categories, toast };
  }

  async function setupFixture() {
    const dependencies = setup();

    await TestBed.configureTestingModule({
      imports: [DashboardComponent, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: dependencies.auth },
        { provide: DashboardService, useValue: dependencies.dashboard },
        { provide: DashboardPreferencesService, useValue: dependencies.prefs },
        { provide: BranchService, useValue: dependencies.branch },
        { provide: ProductCategoryService, useValue: dependencies.categories },
        { provide: ToastService, useValue: dependencies.toast }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    return { fixture, ...dependencies, component: fixture.componentInstance };
  }

  it('restaura preferencias y carga el resumen de la sucursal valida', () => {
    const { component, dashboard } = setup();

    component.ngOnInit();

    expect(component.chartSegment).toBe('cc');
    expect(component.branchId).toBe('branch-a');
    expect(dashboard.getSummary).toHaveBeenCalledWith(
      jasmine.stringMatching(/^\d{4}-\d{2}-01$/),
      jasmine.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      'branch-a',
      []
    );
    expect(component.summary).toBe(summary);
    expect(component.loading).toBeFalse();
  });

  it('carga el resumen aunque falle la lista de sucursales', () => {
    const { component, dashboard } = setup(true);

    component.ngOnInit();

    expect(component.branches).toEqual([]);
    expect(dashboard.getSummary).toHaveBeenCalled();
  });

  it('no permite seleccionar monto sin permiso financiero', () => {
    const { component, prefs } = setup(false, false);

    component.setChartMetric('amount');

    expect(component.chartMetric).toBe('count');
    expect(prefs.writeChartMetric).not.toHaveBeenCalled();
  });

  it('cambiar la serie es instantaneo y no vuelve a pedir el resumen', () => {
    const { component, dashboard, prefs } = setup();

    component.setChartSegment('retail');

    expect(component.chartSegment).toBe('retail');
    expect(prefs.writeChartSegment).toHaveBeenCalledWith('retail');
    expect(dashboard.getSummary).not.toHaveBeenCalled();
  });

  it('usa el permiso de sucursales como fallback mientras se refresca el perfil', () => {
    const { component } = setup(false, true, null);

    expect(component.canViewAllBranches).toBeTrue();
  });

  it('conserva la fecha calendario aunque el backend envie un instante UTC', () => {
    const { component } = setup();
    component.summary = {
      ...summary,
      days: [{
        date: '2026-08-15T00:00:00Z',
        retailCount: 1,
        retailAmount: 100,
        currentAccountCount: 0,
        currentAccountAmount: 0
      }]
    };

    expect(component.chartDays[0].dateKey).toBe('2026-08-15');
  });

  it('el detalle usa el endpoint de dashboard y manda la sucursal', () => {
    const { component, dashboard } = setup();
    component.branchId = 'branch-a';

    component.selectDay('2026-08-15');

    expect(dashboard.listSales).toHaveBeenCalledWith(
      '2026-08-15', '2026-08-15', 'branch-a'
    );
  });

  it('al filtrar canceladas carga todas las ventas de hoy, incluidas las canceladas', () => {
    const { component, dashboard } = setup();
    dashboard.listSales.and.returnValue(of([{
      id: 'cancelled-a',
      code: 'V-9',
      createdAt: new Date().toISOString(),
      customerName: 'Consumidor final',
      saleStatus: 3,
      totalAmount: 0,
      isCuentaCorriente: false
    }]));

    component.selectStatus('cancelled');

    expect(dashboard.listSales).toHaveBeenCalled();
    expect(component.displayedSales.map(sale => sale.id)).toEqual(['cancelled-a']);
  });

  it('ignora un resumen viejo que responde despues de uno mas nuevo', () => {
    const { component, dashboard } = setup();
    const oldRequest = new Subject<DashboardSummaryResponse>();
    const newRequest = new Subject<DashboardSummaryResponse>();
    const newer = { ...summary, month: { ...summary.month, total: { count: 9, units: 9, amount: 900 } } };
    dashboard.getSummary.and.returnValues(oldRequest, newRequest);

    component.loadSummary();
    component.loadSummary();
    newRequest.next(newer);
    oldRequest.next(summary);

    expect(component.summary).toBe(newer);
  });

  it('ignora un detalle viejo cuando se elige otro dia rapidamente', () => {
    const { component, dashboard } = setup();
    const oldRequest = new Subject<any[]>();
    const newRequest = new Subject<any[]>();
    dashboard.listSales.and.returnValues(oldRequest, newRequest);

    component.selectDay('2026-08-14');
    component.selectDay('2026-08-15');
    newRequest.next([{
      id: 'new', code: 'V-2', createdAt: '2026-08-15T12:00:00Z',
      customerName: 'Nuevo', saleStatus: 2, totalAmount: 10, isCuentaCorriente: false
    }]);
    oldRequest.next([{
      id: 'old', code: 'V-1', createdAt: '2026-08-14T12:00:00Z',
      customerName: 'Viejo', saleStatus: 2, totalAmount: 10, isCuentaCorriente: false
    }]);

    expect(component.displayedSales.map(sale => sale.id)).toEqual(['new']);
  });

  it('usa chips para mostrar y cambiar la sucursal activa', async () => {
    const { fixture, component, dashboard } = await setupFixture();
    component.branches = [
      { id: 'branch-a', name: 'Centro', salesCount: 0, cashValue: 0, createdAt: '' },
      { id: 'branch-b', name: 'Norte', salesCount: 0, cashValue: 0, createdAt: '' }
    ];
    fixture.detectChanges();

    const chips = Array.from(
      fixture.nativeElement.querySelectorAll('.branch-chip') as NodeListOf<HTMLButtonElement>
    );
    const labels = chips.map(chip => chip.textContent?.trim());

    expect(fixture.debugElement.query(By.directive(SearchableSelectComponent))).toBeNull();
    expect(labels).toEqual(['Todas', 'Centro', 'Norte']);
    if (chips.length < 3) return;
    expect(chips[1].getAttribute('aria-pressed')).toBe('true');

    chips[2].click();

    expect(component.branchId).toBe('branch-b');
    expect(dashboard.getSummary).toHaveBeenCalledWith(
      jasmine.stringMatching(/^\d{4}-\d{2}-01$/),
      jasmine.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      'branch-b',
      []
    );
  });

  it('presenta las sucursales como pills individuales sin una capsula exterior', async () => {
    const { fixture, component } = await setupFixture();
    component.branches = [
      { id: 'branch-a', name: 'Centro', salesCount: 0, cashValue: 0, createdAt: '' },
      { id: 'branch-b', name: 'Norte', salesCount: 0, cashValue: 0, createdAt: '' }
    ];
    fixture.detectChanges();

    const group = fixture.nativeElement.querySelector('.branch-chips') as HTMLElement;
    const chip = fixture.nativeElement.querySelector('.branch-chip') as HTMLButtonElement;

    expect(getComputedStyle(group).borderTopStyle)
      .withContext('el grupo no debe verse como una capsula gigante')
      .toBe('none');
    expect(getComputedStyle(chip).borderTopStyle)
      .withContext('cada sucursal debe tener su propio limite visual')
      .toBe('solid');
  });

  it('mantiene visible el dia elegido hasta quitar el filtro', async () => {
    const { fixture, component } = await setupFixture();
    component.summary = {
      ...summary,
      days: [{
        date: '2026-08-13T00:00:00Z',
        retailCount: 3,
        retailAmount: 300,
        currentAccountCount: 1,
        currentAccountAmount: 100
      }]
    };
    component.loading = false;

    component.selectDay('2026-08-13');
    fixture.detectChanges();

    const chip = fixture.nativeElement.querySelector('.scope-chip') as HTMLElement | null;
    const selectedBar = fixture.nativeElement.querySelector('.chart-day.is-selected');

    expect(chip).withContext('el día activo debe quedar visible en un chip').not.toBeNull();
    expect(selectedBar).withContext('la barra elegida debe conservar el estado seleccionado').not.toBeNull();
    if (!chip) return;
    expect(chip.textContent).toContain(component.selectedDayLabel);

    (chip.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.selectedDayKey).toBeNull();
    expect(fixture.nativeElement.querySelector('.scope-chip')).toBeNull();
  });

  it('presenta el ritmo comercial como pilares compactos y redondeados', async () => {
    const { fixture, component } = await setupFixture();
    component.summary = {
      ...summary,
      days: [{
        date: '2026-08-15T00:00:00Z',
        retailCount: 3,
        retailAmount: 300,
        currentAccountCount: 1,
        currentAccountAmount: 100
      }]
    };
    component.loading = false;
    fixture.detectChanges();

    const chart = fixture.nativeElement.querySelector('.dual-chart') as HTMLElement;
    const bar = fixture.nativeElement.querySelector('.chart-bar') as HTMLElement;
    const chartStyle = getComputedStyle(chart);
    const barStyle = getComputedStyle(bar);

    expect(chartStyle.display).withContext('los siete días deben formar un grid compacto').toBe('grid');
    expect(Number.parseFloat(barStyle.borderTopLeftRadius))
      .withContext('el remate de las barras debe verse claramente redondeado')
      .toBeGreaterThan(8);
  });

  it('presenta la lectura mensual como bandas elevadas y separa mes de hoy', async () => {
    const { fixture, component } = await setupFixture();
    component.summary = summary;
    component.loading = false;
    fixture.detectChanges();

    const rowStart = fixture.nativeElement.querySelector('.month-table tbody th') as HTMLElement;
    const monthCell = fixture.nativeElement.querySelector('.month-table tbody .month-table__month') as HTMLElement | null;
    const todayCell = fixture.nativeElement.querySelector('.month-table tbody .month-table__today') as HTMLElement | null;

    expect(Number.parseFloat(getComputedStyle(rowStart).borderTopLeftRadius))
      .withContext('cada segmento debe percibirse como una banda redondeada')
      .toBeGreaterThan(8);
    expect(monthCell).withContext('las celdas del mes deben tener una superficie propia').not.toBeNull();
    expect(todayCell).withContext('las celdas de hoy deben tener una superficie propia').not.toBeNull();
    if (!monthCell || !todayCell) return;
    expect(getComputedStyle(monthCell).backgroundColor)
      .withContext('mes y hoy deben distinguirse sin agregar contenido')
      .not.toBe(getComputedStyle(todayCell).backgroundColor);
  });

  it('mantiene visibles los valores del ritmo comercial en mobile', async () => {
    await setupFixture();
    const componentStyles = Array.from(document.head.querySelectorAll('style'))
      .map(style => style.textContent ?? '')
      .find(css => css.includes('.chart-day__values')) ?? '';

    expect(componentStyles)
      .withContext('el breakpoint mobile no debe ocultar los números ubicados sobre las barras')
      .not.toMatch(/@media\s*\(max-width:\s*520px\)[\s\S]*?\.chart-day__values[^\{]*\{[^}]*visibility:\s*hidden/i);
  });
});
