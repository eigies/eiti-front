import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { AuditLogItem } from '../../../../core/models/audit.models';
import { UiAvatarComponent } from '../../../../shared/ui';
import { ChangeRow, PayloadRow } from '../../data-access/audit.facade';
import { AuditDayGroup, auditActionTone, groupAuditByDay } from '../../models/audit-view';

/** Resultados de auditoría agrupados por día; cada acción se abre para ver cambios y datos. */
@Component({
  selector: 'app-audit-table',
  standalone: true,
  imports: [CommonModule, UiAvatarComponent],
  templateUrl: './audit-table.component.html',
  styleUrls: ['./audit-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditTableComponent {
  groups: AuditDayGroup[] = [];

  @Input() set items(items: AuditLogItem[]) {
    this.groups = groupAuditByDay(items ?? []);
  }
  @Input() expandedId: string | null = null;
  @Input() rawVisibleId: string | null = null;
  @Input() actionLabelOf: (actionType: string) => string = type => type;
  @Input() identifierOf: (item: AuditLogItem) => string = () => '-';
  @Input() changesOf: (item: AuditLogItem) => ChangeRow[] = () => [];
  @Input() snapshotOf: (item: AuditLogItem, state: 'before' | 'after') => PayloadRow[] = () => [];
  @Input() rowsOf: (item: AuditLogItem) => PayloadRow[] = () => [];
  @Input() payloadOf: (payloadJson: string | null) => string = () => '';
  @Output() toggleDetail = new EventEmitter<string>();
  @Output() toggleRaw = new EventEmitter<string>();

  readonly tone = auditActionTone;

  trackGroup(_: number, group: AuditDayGroup): string {
    return group.key;
  }

  trackById(_: number, item: AuditLogItem): string {
    return item.id;
  }
}
