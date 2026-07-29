import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ReportService } from '../../../core/services/report.service';
import { CustomerService } from '../../../core/services/customer.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { BranchService } from '../../../core/services/branch.service';
import { ProductCategoryService } from '../../../core/services/product-category.service';
import { ToastService } from '../../../shared/services/toast.service';
import { SalesReportTotals, SALE_CHANNELS } from '../../../core/models/report.models';
import { ProductCategoryResponse } from '../../../core/models/product-category.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';

interface MetricRow { label: string; a: number; b: number; delta: number; money: boolean; }

interface ComparisonFilterValues {
  aFrom: string;
  aTo: string;
  bFrom: string;
  bTo: string;
  customerId: string | null;
  installerId: string | null;
  vehicleId: string | null;
  channel: number | null;
  deliveryMode: string;
  categoryId: string | null;
  saleType: string;
  branchId: string | null;
}

@Component({
  selector: 'app-comparison-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
  templateUrl: './comparison-report.component.html',
  styleUrls: ['../reports.shared.css', './comparison-report.component.css']
})
export class ComparisonReportComponent implements OnInit {
  filterForm: FormGroup;
  loading = false;
  hasSearched = false;
  advancedFiltersOpen = false;
  totalsA: SalesReportTotals | null = null;
  totalsB: SalesReportTotals | null = null;

  customers: { id: string; label: string }[] = [];
  drivers: { id: string; label: string }[] = [];
  vehicles: { id: string; label: string }[] = [];
  branches: { id: string; label: string }[] = [];
  categories: ProductCategoryResponse[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly reportService: ReportService,
    private readonly customerService: CustomerService,
    private readonly employeeService: EmployeeService,
    private readonly vehicleService: VehicleService,
    private readonly branchService: BranchService,
    private readonly productCategoryService: ProductCategoryService,
    private readonly toast: ToastService
  ) {
    const d = this.defaultValues();
    this.filterForm = this.fb.group({
      aFrom: [d.aFrom, Validators.required],
      aTo: [d.aTo, Validators.required],
      bFrom: [d.bFrom, Validators.required],
      bTo: [d.bTo, Validators.required],
      customerId: [d.customerId],
      installerId: [d.installerId],
      vehicleId: [d.vehicleId],
      channel: [d.channel],
      deliveryMode: [d.deliveryMode],
      categoryId: [d.categoryId],
      saleType: [d.saleType],
      branchId: [d.branchId]
    });
  }

  ngOnInit(): void {
    this.loadLookups();
  }

  readonly channels = SALE_CHANNELS;
  readonly deliveryModes = [
    { value: 'all', label: 'Todas' },
    { value: 'with', label: 'Con envio' },
    { value: 'without', label: 'Sin envio' }
  ];
  readonly saleTypes = [
    { value: 'all', label: 'Todas' },
    { value: 'wholesale', label: 'Mayorista (CC)' },
    { value: 'retail', label: 'Minorista' }
  ];

  get customerOptions(): SearchableSelectOption[] { return this.customers.map(c => ({ value: c.id, label: c.label })); }
  get driverOptions(): SearchableSelectOption[] { return this.drivers.map(d => ({ value: d.id, label: d.label })); }
  get vehicleOptions(): SearchableSelectOption[] { return this.vehicles.map(v => ({ value: v.id, label: v.label })); }
  get channelOptions(): SearchableSelectOption[] { return this.channels.map(c => ({ value: c.value, label: c.label })); }
  get deliveryOptions(): SearchableSelectOption[] { return this.deliveryModes.map(d => ({ value: d.value, label: d.label })); }
  get saleTypeOptions(): SearchableSelectOption[] { return this.saleTypes.map(t => ({ value: t.value, label: t.label })); }
  get categoryOptions(): SearchableSelectOption[] { return this.categories.map(c => ({ value: c.id, label: c.name })); }
  get branchOptions(): SearchableSelectOption[] { return this.branches.map(b => ({ value: b.id, label: b.label })); }

  get activeOptionalFiltersCount(): number {
    const value = this.filterForm.value;
    return [
      value.customerId,
      value.installerId,
      value.vehicleId,
      value.channel,
      value.categoryId,
      value.branchId,
      value.deliveryMode && value.deliveryMode !== 'all',
      value.saleType && value.saleType !== 'all'
    ].filter(Boolean).length;
  }

  isInvalid(field: string): boolean {
    const c = this.filterForm.get(field);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  toggleAdvancedFilters(): void {
    this.advancedFiltersOpen = !this.advancedFiltersOpen;
  }

  get rows(): MetricRow[] {
    if (!this.totalsA || !this.totalsB) return [];
    const a = this.totalsA, b = this.totalsB;
    return [
      { label: 'Ventas', a: a.salesCount, b: b.salesCount, delta: this.pct(a.salesCount, b.salesCount), money: false },
      { label: 'Unidades', a: a.units, b: b.units, delta: this.pct(a.units, b.units), money: false },
      { label: 'Facturación', a: a.revenue, b: b.revenue, delta: this.pct(a.revenue, b.revenue), money: true },
      { label: 'Costo', a: a.cost, b: b.cost, delta: this.pct(a.cost, b.cost), money: true },
      { label: 'Ganancia', a: a.profit, b: b.profit, delta: this.pct(a.profit, b.profit), money: true },
      { label: 'Margen %', a: a.marginPct, b: b.marginPct, delta: this.round(b.marginPct - a.marginPct), money: false }
    ];
  }

  search(): void {
    if (this.filterForm.invalid) { this.filterForm.markAllAsTouched(); this.toast.error('Completá ambos rangos de fechas.'); return; }
    const v = this.filterForm.value;
    if (v.aFrom > v.aTo || v.bFrom > v.bTo) { this.toast.error('En cada rango, la fecha desde no puede ser posterior a la hasta.'); return; }

    this.loading = true;
    this.hasSearched = true;
    const shared = {
      groupBy: 'total',
      customerId: v.customerId || null,
      installerId: v.installerId || null,
      vehicleId: v.vehicleId || null,
      channel: v.channel ?? null,
      deliveryMode: v.deliveryMode || 'all',
      categoryId: v.categoryId || null,
      saleType: v.saleType || 'all',
      branchId: v.branchId || null
    };
    forkJoin({
      a: this.reportService.salesReport({ ...shared, dateFrom: v.aFrom, dateTo: v.aTo }),
      b: this.reportService.salesReport({ ...shared, dateFrom: v.bFrom, dateTo: v.bTo })
    }).subscribe({
      next: ({ a, b }) => { this.totalsA = a.totals; this.totalsB = b.totals; this.loading = false; },
      error: (err: { error?: { detail?: string } }) => { this.loading = false; this.toast.error(err?.error?.detail || 'No se pudo generar el comparativo.'); }
    });
  }

  clearFilters(): void {
    this.filterForm.reset(this.defaultValues());
    this.advancedFiltersOpen = false;
    this.totalsA = null;
    this.totalsB = null;
    this.hasSearched = false;
  }

  money(value: number): string { return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  fmt(value: number, money: boolean): string { return money ? '$ ' + this.money(value) : String(value); }
  rangeLabel(fromField: string, toField: string): string {
    return `${this.formatDateOnly(this.filterForm.get(fromField)?.value)} - ${this.formatDateOnly(this.filterForm.get(toField)?.value)}`;
  }

  private loadLookups(): void {
    forkJoin({
      customers: this.customerService.listCustomers().pipe(catchError(() => of([]))),
      drivers: this.employeeService.listDriverEmployees().pipe(catchError(() => of([]))),
      vehicles: this.vehicleService.listVehicles().pipe(catchError(() => of([]))),
      branches: this.branchService.listBranches().pipe(catchError(() => of([]))),
      categories: this.productCategoryService.list().pipe(catchError(() => of([])))
    }).subscribe(({ customers, drivers, vehicles, branches, categories }) => {
      this.customers = customers.map(c => ({ id: c.id, label: c.fullName }));
      this.drivers = drivers.map(d => ({ id: d.id, label: d.fullName }));
      this.vehicles = vehicles.map(v => ({ id: v.id, label: v.model ? `${v.plate} · ${v.model}` : v.plate }));
      this.branches = branches.map(b => ({ id: b.id, label: b.name }));
      this.categories = categories;
    });
  }

  private defaultValues(): ComparisonFilterValues {
    const today = this.toIso(new Date());
    const firstThis = this.toIso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const firstPrev = this.toIso(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
    const lastPrev = this.toIso(new Date(new Date().getFullYear(), new Date().getMonth(), 0));
    return {
      aFrom: firstPrev,
      aTo: lastPrev,
      bFrom: firstThis,
      bTo: today,
      customerId: null,
      installerId: null,
      vehicleId: null,
      channel: null,
      deliveryMode: 'all',
      categoryId: null,
      saleType: 'all',
      branchId: null
    };
  }

  private pct(a: number, b: number): number {
    if (a === 0) return b === 0 ? 0 : 100;
    return this.round((b - a) / Math.abs(a) * 100);
  }
  private formatDateOnly(value: string | null | undefined): string {
    if (!value) return '-';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year.slice(-2)}`;
  }
  private round(n: number): number { return Math.round(n * 100) / 100; }
  private toIso(date: Date): string { return date.toLocaleDateString('en-CA'); }
}
