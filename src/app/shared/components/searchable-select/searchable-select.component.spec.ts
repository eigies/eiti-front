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
    fixture.detectChanges();

    let trigger = fixture.nativeElement.querySelector('.search-select__trigger') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-label')).toBe('Perfil de acceso: Seleccionar perfil');
    expect(trigger.getAttribute('aria-describedby')).toBe('profile-help profile-error');
    expect(trigger.getAttribute('aria-required')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');

    component.writeValue('operations');
    fixture.detectChanges();
    trigger = fixture.nativeElement.querySelector('.search-select__trigger');
    expect(trigger.getAttribute('aria-label')).toBe('Perfil de acceso: Operaciones');
  });

  it('leaves the native visible trigger name intact when no contextual label is supplied', () => {
    const fixture = createSelect();
    fixture.detectChanges();

    let trigger = fixture.nativeElement.querySelector('.search-select__trigger') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-label')).toBeNull();
    expect(trigger.textContent).toContain('Seleccionar perfil');

    fixture.componentInstance.writeValue('operations');
    fixture.detectChanges();
    trigger = fixture.nativeElement.querySelector('.search-select__trigger');
    expect(trigger.getAttribute('aria-label')).toBeNull();
    expect(trigger.textContent).toContain('Operaciones');
  });

  it('renders the searchable popup as a labelled dialog with ordinary option buttons', () => {
    const fixture = createSelect();
    fixture.componentRef.setInput('ariaLabel', 'Perfil de acceso');
    fixture.componentInstance.writeValue('operations');
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.search-select__trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const popup = fixture.nativeElement.querySelector('.search-select__panel') as HTMLElement;
    const options = Array.from(
      fixture.nativeElement.querySelectorAll('.search-select__option')
    ) as HTMLElement[];
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(popup.getAttribute('role')).toBe('dialog');
    expect(popup.getAttribute('aria-label')).toBe('Opciones de Perfil de acceso');
    expect(options.map(option => option.tagName)).toEqual(['BUTTON', 'BUTTON']);
    expect(options.map(option => option.getAttribute('role'))).toEqual([null, null]);
    expect(options.map(option => option.getAttribute('aria-selected'))).toEqual([null, null]);
    expect(options[0].querySelector('.search-select__selected-mark')).not.toBeNull();
  });

  it('owns Escape at the component before the event reaches a surrounding document listener', fakeAsync(() => {
    const surroundingDocumentListener = jasmine.createSpy('surroundingDocumentListener');
    document.addEventListener('keydown', surroundingDocumentListener);
    try {
      const fixture = createSelect();
      const component = fixture.componentInstance;
      fixture.detectChanges();
      const trigger = fixture.nativeElement.querySelector('.search-select__trigger') as HTMLButtonElement;
      trigger.click();
      fixture.detectChanges();
      tick();
      expect(component.open).toBeTrue();

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
      expect(surroundingDocumentListener).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(trigger);
    } finally {
      document.removeEventListener('keydown', surroundingDocumentListener);
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
