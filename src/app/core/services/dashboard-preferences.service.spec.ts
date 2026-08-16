import { DashboardPreferencesService } from './dashboard-preferences.service';

describe('DashboardPreferencesService', () => {
  let service: DashboardPreferencesService;

  beforeEach(() => {
    localStorage.clear();
    service = new DashboardPreferencesService();
  });

  it('devuelve null cuando no hay nada guardado y puede ver todas', () => {
    expect(service.readBranchId(['a', 'b'], true)).toBeNull();
  });

  it('restaura la sucursal guardada si sigue disponible', () => {
    service.writeBranchId('a');
    expect(service.readBranchId(['a', 'b'], true)).toBe('a');
  });

  it('descarta la sucursal guardada si ya no esta disponible', () => {
    service.writeBranchId('z');
    expect(service.readBranchId(['a', 'b'], true)).toBeNull();
  });

  it('sin permiso de ver todas, null cae a la primera sucursal', () => {
    expect(service.readBranchId(['a', 'b'], false)).toBe('a');
  });

  it('sin permiso de ver todas, una sucursal guardada invalida cae a la primera', () => {
    service.writeBranchId('z');
    expect(service.readBranchId(['a', 'b'], false)).toBe('a');
  });

  it('guarda y restaura la serie del grafico', () => {
    service.writeChartSegment('cc');
    expect(service.readChartSegment()).toBe('cc');
  });

  it('descarta un valor de serie invalido', () => {
    localStorage.setItem('eiti_dashboard_chart_segment', 'basura');
    expect(service.readChartSegment()).toBe('both');
  });

  it('descarta una metrica invalida', () => {
    localStorage.setItem('eiti_dashboard_chart_metric', 'basura');
    expect(service.readChartMetric()).toBe('count');
  });
});
