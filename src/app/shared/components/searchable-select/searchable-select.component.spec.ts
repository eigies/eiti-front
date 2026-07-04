import { fakeAsync, TestBed, tick } from '@angular/core/testing';

import { SearchableSelectComponent } from './searchable-select.component';

describe('SearchableSelectComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchableSelectComponent]
    }).compileComponents();
  });

  it('exposes contextual accessible state and names the current placeholder or value', () => {
    const fixture = createSelect();
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('ariaLabel', 'Perfil de acceso');
    fixture.componentRef.setInput('ariaDescribedBy', 'profile-help profile-error');
    fixture.componentRef.setInput('ariaRequired', true);
    fixture.detectChanges();

    let trigger = fixture.nativeElement.querySelector('.search-select__trigger') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-label')).toBe('Perfil de acceso: Seleccionar perfil');
    expect(trigger.getAttribute('aria-describedby')).toBe('profile-help profile-error');
    expect(trigger.getAttribute('aria-required')).toBe('true');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');

    component.writeValue('operations');
    fixture.detectChanges();
    trigger = fixture.nativeElement.querySelector('.search-select__trigger');
    expect(trigger.getAttribute('aria-label')).toBe('Perfil de acceso: Operaciones');
  });

  it('renders the open menu and options with listbox semantics and selection state', () => {
    const fixture = createSelect();
    fixture.componentInstance.writeValue('operations');
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.search-select__trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const listbox = fixture.nativeElement.querySelector('.search-select__panel') as HTMLElement;
    const options = Array.from(
      fixture.nativeElement.querySelectorAll('.search-select__option')
    ) as HTMLElement[];
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(listbox.getAttribute('role')).toBe('listbox');
    expect(options.map(option => option.getAttribute('role'))).toEqual(['option', 'option']);
    expect(options.map(option => option.getAttribute('aria-selected'))).toEqual(['true', 'false']);
  });

  it('owns the first Escape while open, closes and refocuses without reaching later dialog listeners', fakeAsync(() => {
    const fixture = createSelect();
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('.search-select__trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    tick();
    expect(component.open).toBeTrue();

    const laterDialogListener = jasmine.createSpy('laterDialogListener');
    document.addEventListener('keydown', laterDialogListener);
    try {
      const filter = fixture.nativeElement.querySelector('.search-select__input') as HTMLInputElement;
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true
      });
      filter.dispatchEvent(event);
      tick();

      expect(component.open).toBeFalse();
      expect(event.defaultPrevented).toBeTrue();
      expect(laterDialogListener).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(trigger);
    } finally {
      document.removeEventListener('keydown', laterDialogListener);
    }
  }));

  it('keeps ControlValueAccessor selection and disabled behavior intact', () => {
    const fixture = createSelect();
    const component = fixture.componentInstance;
    const changed = jasmine.createSpy('changed');
    component.registerOnChange(changed);
    fixture.detectChanges();

    component.selectOption(component.options[1]);
    expect(changed).toHaveBeenCalledOnceWith('supervision');

    component.setDisabledState(true);
    component.toggle();
    expect(component.open).toBeFalse();
  });

  function createSelect() {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    fixture.componentRef.setInput('options', [
      { value: 'operations', label: 'Operaciones' },
      { value: 'supervision', label: 'Supervisión' }
    ]);
    fixture.componentRef.setInput('placeholder', 'Seleccionar perfil');
    return fixture;
  }
});
