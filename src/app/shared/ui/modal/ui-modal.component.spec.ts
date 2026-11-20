import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { NgIf } from '@angular/common';
import { UiModalComponent } from './ui-modal.component';

@Component({
  standalone: true,
  imports: [UiModalComponent, NgIf],
  template: `
    <ui-modal heading="Editar venta" (closed)="outerClosed = outerClosed + 1"></ui-modal>
    <ui-modal *ngIf="innerOpen" heading="Cambiar caja" [closable]="innerClosable" (closed)="innerClosed = innerClosed + 1; innerOpen = false"></ui-modal>
  `
})
class HostComponent {
  innerOpen = true;
  innerClosable = true;
  outerClosed = 0;
  innerClosed = 0;
}

describe('UiModalComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const pressEscape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('con un popup abierto sobre otro, Escape cierra solo el de arriba', fakeAsync(() => {
    fixture.detectChanges();
    flush();

    pressEscape();
    tick(120);
    fixture.detectChanges();

    expect(host.innerClosed).toBe(1);
    expect(host.outerClosed).toBe(0);

    pressEscape();
    tick(120);

    expect(host.outerClosed).toBe(1);
  }));

  it('tocar afuera no cierra un popup que en ese momento no se puede cerrar', fakeAsync(() => {
    host.innerClosable = false;
    fixture.detectChanges();
    flush();

    const shells = fixture.nativeElement.querySelectorAll('.ui-modal-shell') as NodeListOf<HTMLElement>;
    shells[shells.length - 1].click();
    tick(120);
    flush();

    expect(host.innerClosed).toBe(0);
    expect(host.outerClosed).toBe(0);
  }));
});
