import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ConceptEditModalComponent } from '../../components/concept-edit-modal/concept-edit-modal.component';
import { ConceptTableComponent } from '../../components/concept-table/concept-table.component';
import { DeductionConceptsFacade } from '../data-access/deduction-concepts.facade';

/** Contenedor de /payroll/deduction-concepts: alta arriba, tabla y edición en popup. */
@Component({
  selector: 'app-deduction-concepts-page',
  standalone: true,
  imports: [CommonModule, RouterModule, ConceptTableComponent, ConceptEditModalComponent],
  providers: [DeductionConceptsFacade],
  templateUrl: './deduction-concepts-page.component.html',
  styleUrls: ['../../components/concept-table/concept-page.css']
})
export class DeductionConceptsPageComponent implements OnInit {
  readonly facade = inject(DeductionConceptsFacade);

  ngOnInit(): void {
    this.facade.init();
  }
}
