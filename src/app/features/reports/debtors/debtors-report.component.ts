import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { ReportService } from '../../../core/services/report.service';
import { BranchService } from '../../../core/services/branch.service';
import { CustomerService } from '../../../core/services/customer.service';
import { ToastService } from '../../../shared/services/toast.service';
import { BranchResponse } from '../../../core/models/branch.models';
import { CustomerResponse } from '../../../core/models/customer.models';
import { CustomerDebtorsResponse } from '../../../core/models/report.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';

@Component({
  selector: 'app-debtors-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
  templateUrl: './debtors-report.component.html',
  styleUrls: ['../reports.shared.css']
})
export class DebtorsReportComponent implements OnInit {
  filterForm: FormGroup;
  loading = false;
  data: CustomerDebtorsResponse | null = null;
  /** Sucursal del resultado en pantalla. El saldo a favor es del cliente: por sucursal no hay A favor ni Neto. */
  private appliedBranchId: string | null = null;
  branches: BranchResponse[] = [];
  customers: CustomerResponse[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly reportService: ReportService,
    private readonly branchService: BranchService,
    private readonly customerService: CustomerService,
    private readonly toast: ToastService
  ) {
    this.filterForm = this.fb.group({ branchId: [null], customerId: [null] });
  }

  get branchFiltered(): boolean { return this.appliedBranchId !== null; }

  get branchOptions(): SearchableSelectOption[] { return this.branches.map(b => ({ value: b.id, label: b.name })); }
  get customerOptions(): SearchableSelectOption[] { return this.customers.map(c => ({ value: c.id, label: c.fullName })); }

  ngOnInit(): void {
    this.branchService.listBranches().subscribe({
      next: branches => this.branches = branches,
      error: () => this.branches = []
    });
    this.customerService.listCustomers().subscribe({
      next: customers => this.customers = customers,
      error: () => this.customers = []
    });
    this.load();
  }

  load(): void {
    const { branchId, customerId } = this.filterForm.value;
    this.loading = true;
    this.reportService.customerDebtors({ branchId, customerId }).subscribe({
      next: res => { this.data = res; this.appliedBranchId = branchId || null; this.loading = false; },
      error: (err: { error?: { detail?: string } }) => { this.loading = false; this.toast.error(err?.error?.detail || 'No se pudo cargar el reporte.'); }
    });
  }

  clearFilters(): void {
    this.filterForm.reset({ branchId: null, customerId: null });
    this.load();
  }

  money(value: number): string { return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  formatDate(value: string): string { return new Date(value).toLocaleDateString('es-AR'); }

  exportExcel(): void {
    if (!this.data || this.data.rows.length === 0) { this.toast.error('No hay datos para exportar.'); return; }
    const ws = XLSX.utils.json_to_sheet(this.exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deudores');
    const branch = this.branches.find(b => b.id === this.appliedBranchId)?.name.replace(/\s+/g, '_');
    const name = ['clientes_deudores', branch, new Date().toLocaleDateString('en-CA')].filter(Boolean).join('_');
    XLSX.writeFile(wb, `${name}.xlsx`, { compression: true });
  }

  exportRows(): Record<string, string | number>[] {
    return (this.data?.rows ?? []).map(r => ({
      'Cliente': r.customerName,
      'Ventas abiertas': r.openSalesCount,
      'Más antigua': this.formatDate(r.oldestDate),
      'Adeudado': r.owed,
      ...(this.branchFiltered ? {} : { 'A favor': r.creditBalance, 'Neto': r.net })
    }));
  }
}
