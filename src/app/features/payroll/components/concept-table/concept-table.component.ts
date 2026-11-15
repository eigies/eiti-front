import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

/** Lo mínimo que la tabla necesita de un concepto (de bonificación o de descuento). */
export interface ConceptRow { concept: { id: string; name: string; isActive: boolean; percentage?: number }; expanded: boolean; }

/**
 * Conceptos de sueldo (EITI 2): pestañas Bonificación / Descuento, alta en la franja de arriba
 * y la tabla con estado y Editar. Sirve a las dos pantallas de conceptos.
 */
@Component({
  selector: 'app-concept-table',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './concept-table.component.html',
  styleUrls: ['./concept-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConceptTableComponent {
  @Input() concepts: ConceptRow[] = [];
  @Input() withPercentage = false;
  @Input() canManage = false;
  @Input() createForm: FormGroup | null = null;
  @Input() savingCreate = false;
  @Input() savingToggle = false;
  @Input() namePlaceholder = '';
  @Output() create = new EventEmitter<void>();
  @Output() edit = new EventEmitter<ConceptRow>();
  @Output() toggleActive = new EventEmitter<ConceptRow>();

  trackById(_index: number, view: ConceptRow): string {
    return view.concept.id;
  }
}
