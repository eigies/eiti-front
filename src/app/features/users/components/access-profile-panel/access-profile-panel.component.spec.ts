import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { AccessProfileResponse } from '../../../../core/models/access-profile.models';
import { AccessProfilePanelComponent } from './access-profile-panel.component';

describe('AccessProfilePanelComponent', () => {
  let fixture: ComponentFixture<AccessProfilePanelComponent>;
  let component: AccessProfilePanelComponent;

  const profile: AccessProfileResponse = {
    id: 'p1',
    name: 'Admin',
    description: 'Operación comercial',
    permissionCodes: ['sales.access', 'sales.create'],
    isSystem: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  };
  const permissions = [
    { code: 'sales.access', label: 'Ventas: acceso', description: 'Permite ingresar a ventas.' },
    { code: 'sales.create', label: 'Ventas: crear', description: 'Permite registrar ventas.' },
    { code: 'cash.access', label: 'Caja: acceso', description: 'Permite ingresar a caja.' }
  ] as any;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AccessProfilePanelComponent]
    });

    fixture = TestBed.createComponent(AccessProfilePanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('permissionCatalog', permissions);
  });

  it('loads an existing profile and reports affected users', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('profile', profile);
    fixture.componentRef.setInput('usageCount', 2);
    fixture.detectChanges();

    expect(component.form.controls.name.value).toBe('Admin');
    expect(component.selectedCodes).toEqual(['sales.access', 'sales.create']);
    expect(fixture.nativeElement.textContent).toContain('2 usuarios afectados');
  });

  it('emits normalized friendly profile data', () => {
    fixture.detectChanges();
    component.form.patchValue({ name: '  Caja tarde  ', description: '  Turno tarde  ' });
    component.updateSelectedCodes(['cash.access']);
    spyOn(component.saveRequested, 'emit');

    component.submit();

    expect(component.saveRequested.emit).toHaveBeenCalledWith({
      name: 'Caja tarde',
      description: 'Turno tarde',
      permissionCodes: ['cash.access']
    });
  });

  it('requires a name and at least one permission', () => {
    fixture.detectChanges();
    spyOn(component.saveRequested, 'emit');

    component.submit();
    fixture.detectChanges();

    expect(component.saveRequested.emit).not.toHaveBeenCalled();
    expect(component.form.controls.name.touched).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Seleccioná al menos un permiso');
  });

  it('reports form and permission changes when closing', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('profile', profile);
    fixture.detectChanges();
    spyOn(component.closeRequested, 'emit');

    component.requestClose();
    expect(component.closeRequested.emit).toHaveBeenCalledWith(false);

    component.updateSelectedCodes(['sales.access']);
    component.requestClose();
    expect(component.closeRequested.emit).toHaveBeenCalledWith(true);
  });

  it('does not reset a dirty draft when saving changes', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('profile', profile);
    fixture.detectChanges();
    component.form.controls.name.setValue('Admin personalizado');

    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();

    expect(component.form.controls.name.getRawValue()).toBe('Admin personalizado');
    expect(component.form.disabled).toBeTrue();
  });

  it('blocks duplicate submission and closing while saving', () => {
    fixture.detectChanges();
    component.form.patchValue({ name: 'Caja', description: '' });
    component.updateSelectedCodes(['cash.access']);
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    spyOn(component.saveRequested, 'emit');
    spyOn(component.closeRequested, 'emit');

    component.submit();
    component.requestClose();

    expect(component.saveRequested.emit).not.toHaveBeenCalled();
    expect(component.closeRequested.emit).not.toHaveBeenCalled();
  });

  it('renders friendly permission labels without technical codes', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('profile', profile);
    fixture.detectChanges();

    const matrix = fixture.nativeElement.querySelector('app-permission-matrix');
    expect(matrix).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('sales.access');
  });

  it('is an accessible dialog, focuses its title and handles Escape', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const panel = fixture.nativeElement.querySelector('.profile-panel');
    const title = fixture.nativeElement.querySelector('#access-profile-panel-title');
    spyOn(component.closeRequested, 'emit');

    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(title);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.closeRequested.emit).toHaveBeenCalledWith(false);
  }));

  it('uses the wider profile panel without horizontal overflow', () => {
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const panel = fixture.nativeElement.querySelector('.profile-panel') as HTMLElement;

    host.style.width = '1000px';
    fixture.detectChanges();
    expect(parseFloat(getComputedStyle(panel).width)).toBeLessThanOrEqual(560);
    expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
  });
});
