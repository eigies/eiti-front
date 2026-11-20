import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Ticket oscuro: solo para plata o documentos fiscales, uno por pantalla.
 * Dientes siempre abajo; en modo oscuro pasa a papel claro (ui.css).
 */
@Component({
  selector: 'ui-ticket',
  standalone: true,
  imports: [NgIf],
  templateUrl: './ui-ticket.component.html',
  styleUrls: ['./ui-ticket.component.css'],
  host: { class: 'ui-ticket', 'data-theme': 'dark' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiTicketComponent {
  @Input() label = '';
  @Input() figure: string | null = null;
}
