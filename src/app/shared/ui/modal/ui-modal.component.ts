import { NgIf } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';

export type UiModalSize = 'sm' | 'md' | 'lg';
export type UiModalTone = 'default' | 'danger';

let nextModalId = 0;
/** Popups abiertos (para saber cuál está arriba al apretar Escape). */
const openModals: UiModalComponent[] = [];

/**
 * Popup EITI 2: fondo que se oscurece y ventana que sube (entra 180 ms, sale 120 ms).
 * En las confirmaciones irreversibles, tocar afuera sacude la ventana en vez de cerrarla.
 * El pie se proyecta con el atributo `uiModalFoot`.
 */
@Component({
  selector: 'ui-modal',
  standalone: true,
  imports: [NgIf],
  templateUrl: './ui-modal.component.html',
  styleUrls: ['./ui-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiModalComponent implements AfterViewInit, OnDestroy {
  @Input() eyebrow = '';
  @Input() heading = '';
  @Input() sub = '';
  @Input() size: UiModalSize = 'md';
  @Input() tone: UiModalTone = 'default';
  /** Tocar afuera sacude en lugar de cerrar (confirmaciones que no se pueden deshacer). */
  @Input() irreversible = false;
  /** Escape cierra el popup. */
  @Input() closable = true;
  /** Muestra la X del encabezado. */
  @Input() showClose = true;
  @Input() width: string | null = null;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('dialog', { static: true }) dialog!: ElementRef<HTMLElement>;

  readonly titleId = `ui-modal-title-${++nextModalId}`;
  leaving = false;
  shaking = false;

  private previouslyFocused: HTMLElement | null = null;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly host: ElementRef<HTMLElement>
  ) {}

  ngAfterViewInit(): void {
    openModals.push(this);
    this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setTimeout(() => {
      const root = this.dialog.nativeElement;
      const target = root.querySelector<HTMLElement>('[autofocus]')
        ?? root.querySelector<HTMLElement>('.ui-modal__body input:not([disabled]), .ui-modal__body select:not([disabled]), .ui-modal__body textarea:not([disabled])')
        ?? root.querySelector<HTMLElement>('.ui-modal__foot button:not([disabled])');
      (target ?? root).focus();
    });
  }

  ngOnDestroy(): void {
    const index = openModals.indexOf(this);
    if (index >= 0) {
      openModals.splice(index, 1);
    }
    this.previouslyFocused?.focus?.();
  }

  onBackdrop(): void {
    // Si ahora no se puede cerrar (está guardando), sacude igual que una confirmación irreversible: cerrar acá
    // dejaba la ventana en "saliendo" mientras el padre la mantenía abierta, invisible y tapando la pantalla.
    if (this.irreversible || !this.closable) {
      this.shaking = false;
      this.cdr.markForCheck();
      requestAnimationFrame(() => {
        this.shaking = true;
        this.cdr.markForCheck();
      });
      return;
    }
    this.close();
  }

  close(): void {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    this.cdr.markForCheck();
    setTimeout(() => this.closed.emit(), 120);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    // Con un popup abierto sobre otro (cambiar caja sobre editar venta), Escape cierra solo el de arriba.
    if (this.closable && this.isTopmost()) {
      this.close();
    }
  }

  /**
   * Todos los popups usan el mismo z-index, así que se pinta arriba el que va después en el DOM. El orden en que
   * se abrieron no sirve: un popup dentro de un *ngIf puede inicializarse antes que otro que ya estaba.
   */
  private isTopmost(): boolean {
    const element = this.host.nativeElement;
    return openModals.every(other =>
      other === this || !(element.compareDocumentPosition(other.host.nativeElement) & Node.DOCUMENT_POSITION_FOLLOWING));
  }
}
