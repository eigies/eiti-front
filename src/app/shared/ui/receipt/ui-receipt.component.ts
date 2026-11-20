import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Recibo: un desglose que termina en un total, con el borde cortado abajo. */
@Component({
  selector: 'ui-receipt',
  standalone: true,
  templateUrl: './ui-receipt.component.html',
  styleUrls: ['./ui-receipt.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiReceiptComponent {}
