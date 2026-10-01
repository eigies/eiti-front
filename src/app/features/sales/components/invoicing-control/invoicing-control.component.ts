import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvoiceLetter } from '../../../../core/models/sale.models';
import { InvoiceLetterSwitchComponent } from '../invoice-letter-switch/invoice-letter-switch.component';

/**
 * "Factura electronica" al crear una venta, igual en mostrador y cuenta corriente: el tilde para
 * pedir la factura (o "Automatica" si la sucursal factura sola) y al costado el switch B | A.
 */
@Component({
    selector: 'app-invoicing-control',
    standalone: true,
    imports: [CommonModule, InvoiceLetterSwitchComponent],
    templateUrl: './invoicing-control.component.html',
    styleUrls: ['./invoicing-control.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoicingControlComponent {
    /** Muestra el tilde. False cuando la sucursal factura sola: ahi no hay nada que pedir. */
    @Input() showToggle = true;
    @Input() requested = false;
    /** Se sabe que la venta se va a facturar (tilde o automatica): recien ahi importa la letra. */
    @Input() willInvoice = false;
    @Input() letter: InvoiceLetter = InvoiceLetter.B;
    /** La sucursal elegida no tiene punto de venta de ARCA: la factura se va a rechazar. */
    @Input() missingPointOfSale = false;

    @Output() readonly requestedChange = new EventEmitter<boolean>();
    @Output() readonly letterChange = new EventEmitter<InvoiceLetter>();


    toggle(event: Event): void {
        this.requestedChange.emit((event.target as HTMLInputElement).checked);
    }
}
