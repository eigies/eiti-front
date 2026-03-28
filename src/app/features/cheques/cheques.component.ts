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

@Component({
  selector: 'app-cheques',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cheques.component.html',
  styleUrls: ['./cheques.component.css']
})
export class ChequesComponent implements OnInit {
  cheques: ChequeListItem[] = [];
  banks: BankResponse[] = [];
  loading = false;

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

  trackById(_: number, item: ChequeListItem): string { return item.id; }
}
