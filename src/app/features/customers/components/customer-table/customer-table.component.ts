import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CustomerResponse } from '../../../../core/models/customer.models';
import { UiButtonComponent, UiTableWrapComponent } from '../../../../shared/ui';
import { avatarTone, customerInitial, formatAddress, formatDocument } from '../../models/customer-view';

/** Tabla de clientes con inicial de color, documento, domicilio y acciones. */
@Component({
  selector: 'app-customer-table',
  standalone: true,
  imports: [CommonModule, RouterModule, UiButtonComponent, UiTableWrapComponent],
  templateUrl: './customer-table.component.html',
  styleUrls: ['./customer-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerTableComponent {
  @Input() customers: CustomerResponse[] = [];
  @Input() canDelete = false;
  @Input() deletingId: string | null = null;
  @Output() edit = new EventEmitter<CustomerResponse>();
  @Output() remove = new EventEmitter<CustomerResponse>();

  readonly initial = customerInitial;
  readonly document = formatDocument;
  readonly address = formatAddress;
  readonly tone = avatarTone;

  trackById(_: number, customer: CustomerResponse): string {
    return customer.id;
  }
}
