import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ConceptEditModalComponent } from '../../components/concept-edit-modal/concept-edit-modal.component';
import { ConceptTableComponent } from '../../components/concept-table/concept-table.component';
import { BonusConceptsFacade } from '../data-access/bonus-concepts.facade';

/** Contenedor de /payroll/bonus-concepts: alta arriba, tabla y edición en popup. */
@Component({
  selector: 'app-bonus-concepts-page',
  standalone: true,
  imports: [CommonModule, RouterModule, ConceptTableComponent, ConceptEditModalComponent],
  providers: [BonusConceptsFacade],
  templateUrl: './bonus-concepts-page.component.html',
  styleUrls: ['../../components/concept-table/concept-page.css']
})
export class BonusConceptsPageComponent implements OnInit {
  readonly facade = inject(BonusConceptsFacade);

  ngOnInit(): void {
    this.facade.init();
  }
}
