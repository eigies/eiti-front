import { ChangeDetectorRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { SaleService } from '../../../core/services/sale.service';
import { ToastService } from '../../services/toast.service';
import { SaleNotesComponent } from './sale-notes.component';

describe('SaleNotesComponent', () => {
  function setup(canEdit = true) {
    const sales = jasmine.createSpyObj<SaleService>('SaleService', ['updateSaleNotes']);
    sales.updateSaleNotes.and.returnValue(of(void 0));
    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['error', 'success']);
    const cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck']);
    const component = new SaleNotesComponent(sales, toast, cdr);
    component.saleId = 'sale-1';
    component.notes = 'Presup. 1234';
    component.canEdit = canEdit;
    const saved: (string | null)[] = [];
    component.saved.subscribe(value => saved.push(value));
    return { component, sales, toast, saved };
  }

  it('arranca la edición con la nota actual', () => {
    const { component } = setup();
    component.startEdit();
    expect(component.editing).toBeTrue();
    expect(component.draft).toBe('Presup. 1234');
  });

  it('guarda la nota recortada y la avisa', () => {
    const { component, sales, saved } = setup();
    component.startEdit();
    component.draft = '  Presup. 1234 - Patente AB123CD  ';

    component.save();

    expect(sales.updateSaleNotes).toHaveBeenCalledWith('sale-1', 'Presup. 1234 - Patente AB123CD');
    expect(saved).toEqual(['Presup. 1234 - Patente AB123CD']);
    expect(component.editing).toBeFalse();
  });

  it('una nota vacía se guarda como sin observaciones', () => {
    const { component, sales, saved } = setup();
    component.startEdit();
    component.draft = '   ';

    component.save();

    expect(sales.updateSaleNotes).toHaveBeenCalledWith('sale-1', null);
    expect(saved).toEqual([null]);
  });

  it('si el back rechaza, muestra el motivo y sigue editando', () => {
    const { component, sales, toast, saved } = setup();
    sales.updateSaleNotes.and.returnValue(throwError(() => ({ error: { detail: 'No se pueden editar las observaciones de una venta anulada.' } })));
    component.startEdit();
    component.draft = 'Patente AB123CD';

    component.save();

    expect(toast.error).toHaveBeenCalledWith('No se pueden editar las observaciones de una venta anulada.');
    expect(saved).toEqual([]);
    expect(component.editing).toBeTrue();
  });

  it('sin permiso no entra en edición', () => {
    const { component } = setup(false);
    component.startEdit();
    expect(component.editing).toBeFalse();
  });
});
