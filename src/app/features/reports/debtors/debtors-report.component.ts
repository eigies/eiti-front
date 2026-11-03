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
  /** El resultado en pantalla es de una sucursal: el saldo a favor sigue siendo el total del cliente. */
  branchFiltered = false;
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
      next: res => { this.data = res; this.branchFiltered = !!branchId; this.loading = false; },
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
    const rows = this.data.rows.map(r => ({
      'Cliente': r.customerName,
      'Ventas abiertas': r.openSalesCount,
      'Más antigua': this.formatDate(r.oldestDate),
      'Adeudado': r.owed,
      'A favor': r.creditBalance,
      'Neto': r.net
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deudores');
    XLSX.writeFile(wb, `clientes_deudores_${new Date().toLocaleDateString('en-CA')}.xlsx`, { compression: true });
  }
}
