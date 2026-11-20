import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AuditLogItem } from '../../../core/models/audit.models';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent } from '../../../shared/ui';
import { AuditTableComponent } from '../components/audit-table/audit-table.component';
import { AuditFacade } from '../data-access/audit.facade';

/** Contenedor de /auditoria: filtros por usuario y fechas, resultados por día y exportar. */
@Component({
  selector: 'app-audit-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent, AuditTableComponent],
  providers: [AuditFacade],
  templateUrl: './audit-page.component.html',
  styleUrls: ['./audit-page.component.css']
})
export class AuditPageComponent implements OnInit {
  readonly facade = inject(AuditFacade);
  readonly actionLabelOf = (type: string): string => this.facade.actionLabel(type);
  readonly identifierOf = (item: AuditLogItem): string => this.facade.rowIdentifier(item);
  readonly changesOf = (item: AuditLogItem) => this.facade.changeRows(item);
  readonly snapshotOf = (item: AuditLogItem, state: 'before' | 'after') => this.facade.snapshotRows(item, state);
  readonly rowsOf = (item: AuditLogItem) => this.facade.humanizeRows(item);
  readonly payloadOf = (json: string | null): string => this.facade.prettyPayload(json);

  ngOnInit(): void {
    this.facade.init();
  }

  onPageSize(value: string): void {
    this.facade.changePageSize(Number(value));
  }
}
