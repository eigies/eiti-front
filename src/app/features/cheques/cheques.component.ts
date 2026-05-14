import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ChequeService } from '../../core/services/cheque.service';
import { BankService } from '../../core/services/bank.service';
import { ToastService } from '../../shared/services/toast.service';
import {
  ChequeDetail,
  ChequeFilters,
  ChequeListItem,
  CHEQUE_STATUS_BADGE,
  CHEQUE_STATUS_LABELS,
  CHEQUE_TRANSITIONS,
  ChequeStatus
} from '../../core/models/cheque.models';
import { BankResponse } from '../../core/models/bank.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';

@Component({
  selector: 'app-cheques',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
  templateUrl: './cheques.component.html',
  styleUrls: ['./cheques.component.css']
})
export class ChequesComponent implements OnInit {
  cheques: ChequeListItem[] = [];
  banks: BankResponse[] = [];
  loading = false;
  readonly soonWindowDays = 7;

  filterForm: FormGroup;

  detailModalOpen = false;
  detailCheque: ChequeDetail | null = null;
  detailLoading = false;
  updatingStatus = false;

  readonly statusLabels = CHEQUE_STATUS_LABELS;
  readonly statusBadge = CHEQUE_STATUS_BADGE;
  readonly transitions = CHEQUE_TRANSITIONS;
  readonly allStatuses = [
    ChequeStatus.EnCartera,
    ChequeStatus.Depositado,
    ChequeStatus.Acreditado,
    ChequeStatus.Rechazado,
    ChequeStatus.Anulado
  ];

  get statusOptions(): SearchableSelectOption[] {
    return this.allStatuses.map(status => ({
      value: status,
      label: this.statusLabel(status)
    }));
  }

  get bankOptions(): SearchableSelectOption[] {
    return this.banks.map(bank => ({
      value: bank.id,
      label: bank.name
    }));
  }

  get totalAmount(): number {
    return this.cheques.reduce((sum, cheque) => sum + cheque.monto, 0);
  }

  get portfolioCount(): number {
    return this.cheques.filter(cheque => cheque.estado === ChequeStatus.EnCartera).length;
  }

  get depositedCount(): number {
    return this.cheques.filter(cheque => cheque.estado === ChequeStatus.Depositado).length;
  }

  get urgentCount(): number {
    return this.cheques.filter(cheque => this.isUrgent(cheque)).length;
  }

  get activeFilterCount(): number {
    const formValue = this.filterForm.value;
    return Object.values(formValue).filter(value => value !== null && value !== '').length;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly chequeService: ChequeService,
    private readonly bankService: BankService,
    private readonly toast: ToastService
  ) {
    this.filterForm = this.fb.group({
      estado: [null],
      bankId: [null],
      fechaVencFrom: [''],
      fechaVencTo: ['']
    });
  }

  ngOnInit(): void {
    this.loadBanks();
    this.loadCheques();
  }

  loadBanks(): void {
    this.bankService.listBanks(false).subscribe({
      next: banks => this.banks = banks,
      error: () => {}
    });
  }

  loadCheques(): void {
    this.loading = true;
    const f = this.filterForm.value;
    const filters: ChequeFilters = {
      estado: f.estado ? Number(f.estado) : null,
      bankId: f.bankId ? Number(f.bankId) : null,
      fechaVencFrom: f.fechaVencFrom || null,
      fechaVencTo: f.fechaVencTo || null
    };
    this.chequeService.listCheques(filters).subscribe({
      next: cheques => { this.cheques = cheques; this.loading = false; },
      error: () => { this.toast.error('No se pudieron cargar los cheques'); this.loading = false; }
    });
  }

  applyFilters(): void { this.loadCheques(); }

  clearFilters(): void { this.filterForm.reset(); this.loadCheques(); }

  openDetail(item: ChequeListItem): void {
    this.detailModalOpen = true;
    this.detailCheque = null;
    this.detailLoading = true;
    this.chequeService.getChequeById(item.id).subscribe({
      next: detail => { this.detailCheque = detail; this.detailLoading = false; },
      error: () => {
        this.toast.error('No se pudo cargar el detalle');
        this.detailLoading = false;
        this.detailModalOpen = false;
      }
    });
  }

  closeDetail(): void { this.detailModalOpen = false; this.detailCheque = null; }

  getNextStates(estado: number): number[] {
    return this.transitions[estado] ?? [];
  }

  getTransitionBtnClass(status: number): string {
    const map: Record<number, string> = {
      [ChequeStatus.Depositado]: 'btn--amber',
      [ChequeStatus.Acreditado]: 'btn--success',
      [ChequeStatus.Rechazado]: 'btn--danger',
      [ChequeStatus.Anulado]: 'btn--ghost'
    };
    return map[status] ?? 'btn--ghost';
  }

  changeStatus(newStatus: number): void {
    if (!this.detailCheque || this.updatingStatus) return;
    if (!confirm(`Cambiar estado a "${this.statusLabels[newStatus]}"?`)) return;
    this.updatingStatus = true;
    this.chequeService.updateChequeStatus(this.detailCheque.id, newStatus).subscribe({
      next: updated => {
        this.detailCheque = updated;
        this.updatingStatus = false;
        this.toast.success('Estado actualizado');
        this.loadCheques();
      },
      error: (err: unknown) => {
        this.updatingStatus = false;
        const e = err as { error?: { detail?: string } };
        this.toast.error(e?.error?.detail || 'Error al cambiar estado');
      }
    });
  }

  statusLabel(estado: number): string { return this.statusLabels[estado] ?? estado.toString(); }
  statusClass(estado: number): string { return this.statusBadge[estado] ?? 'badge'; }
  isUrgent(cheque: Pick<ChequeListItem, 'estado' | 'fechaVencimiento'>): boolean {
    if (cheque.estado === ChequeStatus.Acreditado || cheque.estado === ChequeStatus.Rechazado || cheque.estado === ChequeStatus.Anulado) {
      return false;
    }

    const dueDate = new Date(`${cheque.fechaVencimiento}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
    return diffDays <= this.soonWindowDays;
  }

  urgencyLabel(cheque: Pick<ChequeListItem, 'fechaVencimiento'>): string {
    const dueDate = new Date(`${cheque.fechaVencimiento}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);

    if (diffDays < 0) return 'Vencido';
    if (diffDays === 0) return 'Vence hoy';
    if (diffDays === 1) return 'Vence manana';
    return `Vence en ${diffDays} dias`;
  }

  trackById(_: number, item: ChequeListItem): string { return item.id; }
}
