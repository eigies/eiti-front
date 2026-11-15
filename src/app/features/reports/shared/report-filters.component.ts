import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export interface ReportChip { key: string; label: string; }

/**
 * Filtros de la plantilla B de reportes: las fechas (o los filtros principales) siempre a la vista,
 * "Más filtros" con su contador y, abajo, las etiquetas de los filtros activos.
 * Va dentro del <form> de la página: Aplicar es el submit de ese formulario.
 */
@Component({
  selector: 'app-report-filters',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './report-filters.component.html',
  styleUrls: ['./report-filters.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportFiltersComponent {
  @Input() hasMore = false;
  @Input() open = false;
  @Input() count = 0;
  @Input() canApply = true;
  @Input() showClear = true;
  @Input() applyLabel = 'Aplicar';
  @Input() chips: ReportChip[] = [];
  @Input() moreId = 'report-more-filters';
  @Output() toggle = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();
  @Output() removeChip = new EventEmitter<string>();

  trackChip(_: number, chip: ReportChip): string {
    return chip.key;
  }
}
