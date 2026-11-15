import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ChequeListItem, ChequeOrigen } from '../../../../core/models/cheque.models';
import { UiTableWrapComponent } from '../../../../shared/ui';
import { chequeStatusBadge } from '../../models/cheque-view';

/** Listado de cheques: estado con color y aviso de vencimiento bajo la fecha. */
@Component({
  selector: 'app-cheques-table',
  standalone: true,
  imports: [CommonModule, UiTableWrapComponent],
  templateUrl: './cheques-table.component.html',
  styleUrls: ['./cheques-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChequesTableComponent {
  @Input() cheques: ChequeListItem[] = [];
  @Input() statusLabels: Record<number, string> = {};
  @Input() isUrgentFn: (cheque: ChequeListItem) => boolean = () => false;
  @Input() urgencyLabelFn: (cheque: ChequeListItem) => string = () => '';
  @Input() dateLabelFn: (value: string) => string = value => value;
  @Output() open = new EventEmitter<ChequeListItem>();

  readonly propio = ChequeOrigen.Propio;
  readonly badge = chequeStatusBadge;

  trackById(_: number, item: ChequeListItem): string { return item.id; }
}
