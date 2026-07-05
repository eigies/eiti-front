import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AccessProfileResponse } from '../../../../core/models/access-profile.models';
import { UserResponse } from '../../../../core/models/user.models';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { AccessProfileListComponent } from './access-profile-list.component';

describe('AccessProfileListComponent', () => {
  let fixture: ComponentFixture<AccessProfileListComponent>;
  let component: AccessProfileListComponent;

  const adminProfile: AccessProfileResponse = {
    id: 'p1',
    name: 'Admin',
    description: 'Operación comercial',
    permissionCodes: ['sales.access', 'sales.create'],
    isSystem: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  };
  const cashierProfile: AccessProfileResponse = {
    id: 'p2',
    name: 'Caja tarde',
    description: 'Turno de cierre',
    permissionCodes: ['cash.access'],
    isSystem: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  };
  const user = {
    id: 'u1',
    username: 'agustin',
    email: 'a@x.com',
    isActive: true,
    profileId: 'p1',
    profileName: 'Admin',
    permissions: [],
    branchIds: [],
    createdAt: '2026-01-01'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AccessProfileListComponent]
    });

    fixture = TestBed.createComponent(AccessProfileListComponent);
    component = fixture.componentInstance;
  });

  it('shows usage counts and emits the selected profile', () => {
    fixture.componentRef.setInput('profiles', [adminProfile]);
    fixture.componentRef.setInput('users', [user]);
    fixture.detectChanges();
    spyOn(component.profileSelected, 'emit');

    expect(fixture.nativeElement.textContent).toContain('1 usuario');
    fixture.nativeElement.querySelector('[data-profile-id="p1"] .profile-list__open').click();

    expect(component.profileSelected.emit).toHaveBeenCalledWith(adminProfile);
  });

  it('combines query, type and usage filters without mutating inputs', () => {
    const profiles = [adminProfile, cashierProfile];
    fixture.componentRef.setInput('profiles', profiles);
    fixture.componentRef.setInput('users', [user]);
    fixture.detectChanges();

    component.updateFilters({ query: 'cierre', type: 'custom', usage: 'unused' });

    expect(component.visibleProfiles).toEqual([cashierProfile]);
    expect(component.profiles).toBe(profiles);
    expect(component.profiles).toEqual([adminProfile, cashierProfile]);
  });

  it('clears active filters', () => {
    fixture.componentRef.setInput('profiles', [adminProfile, cashierProfile]);
    fixture.detectChanges();
    component.setType('custom');
    expect(component.hasActiveFilters).toBeTrue();

    component.clearFilters();

    expect(component.hasActiveFilters).toBeFalse();
    expect(component.visibleProfiles.length).toBe(2);
  });

  it('uses the application searchable selects for every catalog filter', () => {
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      'input[type="search"]'
    ) as HTMLInputElement;
    const selectors = fixture.debugElement.queryAll(By.directive(SearchableSelectComponent));

    expect(selectors.length).toBe(2);
    expect(fixture.nativeElement.querySelector('select')).toBeNull();

    const type = selectors[0].componentInstance as SearchableSelectComponent;
    expect(type.options.map(option => option.value)).toEqual(['all', 'system', 'custom']);
    type.selectOption(type.options[2]);
    expect(component.filters.type).toBe('custom');

    const trigger = selectors[0].nativeElement.querySelector(
      '.search-select__trigger'
    ) as HTMLButtonElement;
    for (const control of [input, trigger]) {
      const style = getComputedStyle(control);
      expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      expect(style.borderTopLeftRadius).toBe('8px');
    }
  });

  it('distinguishes an empty catalog from filtered results', () => {
    fixture.componentRef.setInput('profiles', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay perfiles');

    fixture.componentRef.setInput('profiles', [adminProfile]);
    fixture.detectChanges();
    component.setQuery('sin coincidencia');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hay perfiles que coincidan');
  });

  it('emits deletion without also opening the editor', () => {
    fixture.componentRef.setInput('profiles', [cashierProfile]);
    fixture.detectChanges();
    spyOn(component.deleteRequested, 'emit');
    spyOn(component.profileSelected, 'emit');

    fixture.nativeElement.querySelector('[data-profile-id="p2"] .profile-list__delete').click();

    expect(component.deleteRequested.emit).toHaveBeenCalledWith(cashierProfile);
    expect(component.profileSelected.emit).not.toHaveBeenCalled();
  });

  it('marks the selected row and gives actions contextual names', () => {
    fixture.componentRef.setInput('profiles', [adminProfile]);
    fixture.componentRef.setInput('selectedProfileId', 'p1');
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('[data-profile-id="p1"]');
    expect(row.classList).toContain('profile-list__row--selected');
    expect(row.querySelector('.profile-list__open').getAttribute('aria-label'))
      .toBe('Editar perfil Admin');
    expect(row.querySelector('.profile-list__delete').getAttribute('aria-label'))
      .toBe('Eliminar perfil Admin');
  });

  it('renders stable skeletons while loading', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.profile-list__skeleton-row').length).toBe(4);
  });

  it('keeps compact actions touch friendly', () => {
    fixture.componentRef.setInput('profiles', [adminProfile]);
    fixture.detectChanges();

    const edit = fixture.nativeElement.querySelector('.profile-list__open');
    expect(parseFloat(getComputedStyle(edit).minHeight)).toBeGreaterThanOrEqual(40);
  });
});
