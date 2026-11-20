import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ChequeDetail, ChequeOrigen } from '../../../../core/models/cheque.models';
import { UiButtonComponent, UiModalComponent } from '../../../../shared/ui';
import { chequeStatusBadge, chequeTransitionButton } from '../../models/cheque-view';

/** Detalle dibujado como un cheque (tarjeta lisa, campos con etiqueta arriba y subrayado, monto en recuadro). */
@Component({
  selector: 'app-cheque-detail-modal',
  standalone: true,
  imports: [CommonModule, UiModalComponent, UiButtonComponent],
  templateUrl: './cheque-detail-modal.component.html',
  styleUrls: ['./cheque-detail-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChequeDetailModalComponent {
  @Input() cheque: ChequeDetail | null = null;
  @Input() loading = false;
  @Input() updating = false;
  @Input() statusLabels: Record<number, string> = {};
  @Input() nextStates: number[] = [];
  @Input() terminalLabel = '';
  @Input() dateLabelFn: (value: string) => string = value => value;
  @Output() closed = new EventEmitter<void>();
  @Output() changeStatus = new EventEmitter<number>();

  readonly propio = ChequeOrigen.Propio;
  readonly badge = chequeStatusBadge;
  readonly button = chequeTransitionButton;
}
