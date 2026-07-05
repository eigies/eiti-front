import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PermissionMatrixComponent } from './permission-matrix.component';

describe('PermissionMatrixComponent', () => {
  let fixture: ComponentFixture<PermissionMatrixComponent>;
  let component: PermissionMatrixComponent;

  const permissions = [
    {
      code: 'sales.access',
      label: 'Ventas: acceso',
      description: 'Permite ingresar al módulo de ventas.'
    },
    {
      code: 'sales.create',
      label: 'Ventas: crear',
      description: 'Permite registrar ventas nuevas.'
    },
    {
      code: 'cash.access',
      label: 'Caja: acceso',
      description: 'Permite ingresar al módulo de caja.'
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PermissionMatrixComponent]
    });

    fixture = TestBed.createComponent(PermissionMatrixComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('permissions', permissions);
    fixture.componentRef.setInput('selectedCodes', ['sales.access']);
    fixture.detectChanges();
  });

  it('groups permissions by module and never renders technical codes', () => {
    expect(fixture.nativeElement.textContent).toContain('Ventas');
    expect(fixture.nativeElement.textContent).toContain('1 de 2 seleccionados');
    expect(fixture.nativeElement.textContent).not.toContain('sales.access');
  });

  it('starts modules collapsed and exposes expansion state', () => {
    const trigger = fixture.nativeElement.querySelector('[data-module="Ventas"]');

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('#permission-module-ventas')).toBeNull();

    trigger.click();
    fixture.detectChanges();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('#permission-module-ventas')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Permite registrar ventas nuevas.');
  });

  it('emits a new immutable selection when toggling a module', () => {
    const originalSelection = component.selectedCodes;
    spyOn(component.selectedCodesChange, 'emit');

    component.toggleModule(['sales.access', 'sales.create']);

    expect(component.selectedCodesChange.emit)
      .toHaveBeenCalledWith(['sales.access', 'sales.create']);
    expect(component.selectedCodes).toBe(originalSelection);
    expect(component.selectedCodes).toEqual(['sales.access']);
  });

  it('emits a new immutable selection when toggling one permission', () => {
    spyOn(component.selectedCodesChange, 'emit');

    component.togglePermission('sales.create');

    expect(component.selectedCodesChange.emit)
      .toHaveBeenCalledWith(['sales.access', 'sales.create']);
  });

  it('filters by description and only shows matching modules', () => {
    component.setQuery('registrar ventas');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ventas');
    expect(fixture.nativeElement.textContent).not.toContain('Caja');
  });

  it('can show only selected permissions', () => {
    component.setSelectedOnly(true);
    component.toggleExpanded('Ventas');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('acceso');
    expect(fixture.nativeElement.textContent).not.toContain('crear');
    expect(fixture.nativeElement.textContent).not.toContain('Caja');
  });

  it('shows a distinct empty result for unmatched filters', () => {
    component.setQuery('permiso inexistente');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.permission-matrix__empty').textContent)
      .toContain('No hay permisos que coincidan');
  });

  it('keeps controls accessible and touch friendly', () => {
    const search = fixture.nativeElement.querySelector('#permission-search');
    const moduleTrigger = fixture.nativeElement.querySelector('[data-module="Ventas"]');

    expect(search.getAttribute('aria-label')).toBe('Buscar permisos');
    expect(moduleTrigger.getAttribute('aria-controls')).toBe('permission-module-ventas');
    expect(parseFloat(getComputedStyle(moduleTrigger).minHeight)).toBeGreaterThanOrEqual(44);
  });

  it('uses soft custom checks and selected permission cards', () => {
    component.toggleExpanded('Ventas');
    fixture.detectChanges();

    const check = fixture.nativeElement.querySelector(
      '.permission-row input'
    ) as HTMLInputElement;
    const row = fixture.nativeElement.querySelector(
      '.permission-row--selected'
    ) as HTMLElement;

    expect(getComputedStyle(check).appearance).toBe('none');
    expect(getComputedStyle(check).borderTopLeftRadius).toBe('5px');
    expect(getComputedStyle(row).borderTopWidth).toBe('1px');
    expect(getComputedStyle(row).borderTopLeftRadius).toBe('10px');
  });
});
