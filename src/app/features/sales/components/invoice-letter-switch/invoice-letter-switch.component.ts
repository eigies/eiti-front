import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { InvoiceLetter } from '../../../../core/models/sale.models';

/** Switch compacto B | A. Lo usan el alta de la venta y el popup de facturar despues del alta. */
@Component({
    selector: 'app-invoice-letter-switch',
    standalone: true,
    templateUrl: './invoice-letter-switch.component.html',
    styleUrls: ['./invoice-letter-switch.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoiceLetterSwitchComponent {
    @Input() letter: InvoiceLetter = InvoiceLetter.B;
    @Input() disabled = false;
    @Output() readonly letterChange = new EventEmitter<InvoiceLetter>();

    readonly invoiceLetter = InvoiceLetter;
}
