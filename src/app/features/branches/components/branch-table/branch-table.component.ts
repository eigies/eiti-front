import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { BranchResponse } from '../../../../core/models/branch.models';

/** Tabla de sucursales: código, facturación con su punto de venta, ventas y caja actual. */
@Component({
  selector: 'app-branch-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './branch-table.component.html',
  styleUrls: ['./branch-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BranchTableComponent {
  @Input() branches: Array<{ branch: BranchResponse }> = [];
  @Input() canManage = false;
  @Input() canViewFinancials = false;
  @Input() deletingId: string | null = null;
  @Input() invoicingOf: (branch: BranchResponse) => string = () => '';
  @Input() originOf: (branch: BranchResponse) => string = () => '';
  @Input() automaticOf: (branch: BranchResponse) => boolean | null = () => null;
  @Input() pointOfSaleOf: (branch: BranchResponse) => string = () => '';
  @Output() edit = new EventEmitter<BranchResponse>();
  @Output() remove = new EventEmitter<BranchResponse>();

  trackById(_index: number, item: { branch: BranchResponse }): string {
    return item.branch.id;
  }
}
