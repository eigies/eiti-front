import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { ReportService } from '../../../core/services/report.service';
import { CustomerService } from '../../../core/services/customer.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { ProductCategoryService } from '../../../core/services/product-category.service';
import { ToastService } from '../../../shared/services/toast.service';
import { SalesReportResponse, SALE_CHANNELS } from '../../../core/models/report.models';
import { ProductCategoryResponse } from '../../../core/models/product-category.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';

interface ReportMeta { title: string; eyebrow: string; }

const META: Record<string, ReportMeta> = {
  product: { title: 'Ventas por modelo', eyebrow: 'Reporteria / Ventas' },
  product_ranking: { title: 'Ranking de articulos', eyebrow: 'Reporteria / Ventas' },
  brand: { title: 'Ventas por marca', eyebrow: 'Reporteria / Ventas' },
  channel: { title: 'Ventas por canal', eyebrow: 'Reporteria / Ventas' },
  channel_brand: { title: 'Ventas por canal y marca', eyebrow: 'Reporteria / Ventas' },
  installer: { title: 'Ventas por instalador / vehiculo', eyebrow: 'Reporteria / Ventas' },
  vehicle: { title: 'Ventas por instalador / vehiculo', eyebrow: 'Reporteria / Ventas' }
};

@Component({
  selector: 'app-sales-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
  templateUrl: './sales-report.component.html',
  styleUrls: ['../reports.shared.css']
})
export class SalesReportComponent implements OnInit {
  filterForm: FormGroup;
  baseTipo = 'product';
  transportMode: 'installer' | 'vehicle' = 'installer';
  advancedFiltersOpen = false;

  loading = false;
  hasSearched = false;
  data: SalesReportResponse | null = null;

  customers: { id: string; label: string }[] = [];
  drivers: { id: string; label: string }[] = [];
  vehicles: { id: string; label: string }[] = [];
  categories: ProductCategoryResponse[] = [];

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

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly reportService: ReportService,
    private readonly customerService: CustomerService,
    private readonly employeeService: EmployeeService,
    private readonly vehicleService: VehicleService,
    private readonly productCategoryService: ProductCategoryService,
    private readonly toast: ToastService
  ) {
    const today = this.toIso(new Date());
    const firstOfMonth = this.toIso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    this.filterForm = this.fb.group({
      dateFrom: [firstOfMonth, Validators.required],
      dateTo: [today, Validators.required],
      customerId: [null],
      installerId: [null],
      vehicleId: [null],
      channel: [null],
      deliveryMode: ['all'],
      categoryId: [null],
      saleType: ['all']
    });
  }

  ngOnInit(): void {
    this.baseTipo = (this.route.snapshot.data['tipo'] as string) || 'product';
    this.loadLookups();
    this.search();
  }

  get groupBy(): string {
    return this.baseTipo === 'installer' || this.baseTipo === 'vehicle' ? this.transportMode : this.baseTipo;
  }

  get meta(): ReportMeta { return META[this.baseTipo] ?? META['product']; }
  get isTransport(): boolean { return this.baseTipo === 'installer' || this.baseTipo === 'vehicle'; }
  get isChannelBrand(): boolean { return this.groupBy === 'channel_brand'; }
  get dimensionHeader(): string {
    switch (this.groupBy) {
      case 'brand': return 'Marca';
      case 'channel': return 'Canal';
      case 'channel_brand': return 'Canal';
      case 'installer': return 'Instalador';
      case 'vehicle': return 'Vehiculo';
      default: return 'Modelo';
    }
  }

  get customerOptions(): SearchableSelectOption[] { return this.customers.map(c => ({ value: c.id, label: c.label })); }
  get driverOptions(): SearchableSelectOption[] { return this.drivers.map(d => ({ value: d.id, label: d.label })); }
  get vehicleOptions(): SearchableSelectOption[] { return this.vehicles.map(v => ({ value: v.id, label: v.label })); }
  get channelOptions(): SearchableSelectOption[] { return this.channels.map(c => ({ value: c.value, label: c.label })); }
  get deliveryOptions(): SearchableSelectOption[] { return this.deliveryModes.map(d => ({ value: d.value, label: d.label })); }
  get saleTypeOptions(): SearchableSelectOption[] { return this.saleTypes.map(t => ({ value: t.value, label: t.label })); }
  get categoryOptions(): SearchableSelectOption[] { return this.categories.map(c => ({ value: c.id, label: c.name })); }
  get activeOptionalFiltersCount(): number {
    const value = this.filterForm.value;
    return [
      value.customerId,
      value.installerId,
      value.vehicleId,
      value.channel,
      value.categoryId,
      value.deliveryMode && value.deliveryMode !== 'all',
      value.saleType && value.saleType !== 'all'
    ].filter(Boolean).length;
  }

  isInvalid(field: string): boolean {
    const c = this.filterForm.get(field);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  setTransportMode(mode: 'installer' | 'vehicle'): void {
    if (this.transportMode === mode) return;
    this.transportMode = mode;
    this.search();
  }

  toggleAdvancedFilters(): void {
    this.advancedFiltersOpen = !this.advancedFiltersOpen;
  }

  private loadLookups(): void {
    forkJoin({
      customers: this.customerService.listCustomers().pipe(catchError(() => of([]))),
      drivers: this.employeeService.listDriverEmployees().pipe(catchError(() => of([]))),
      vehicles: this.vehicleService.listVehicles().pipe(catchError(() => of([]))),
      categories: this.productCategoryService.list().pipe(catchError(() => of([])))
    }).subscribe(({ customers, drivers, vehicles, categories }) => {
      this.customers = customers.map(c => ({ id: c.id, label: c.fullName }));
      this.drivers = drivers.map(d => ({ id: d.id, label: d.fullName }));
      this.vehicles = vehicles.map(v => ({ id: v.id, label: v.model ? `${v.plate} · ${v.model}` : v.plate }));
      this.categories = categories;
    });
  }

  search(): void {
    if (this.filterForm.invalid) {
      this.filterForm.markAllAsTouched();
      this.toast.error('Las fechas desde y hasta son obligatorias.');
      return;
    }
    const v = this.filterForm.value;
    if (v.dateFrom > v.dateTo) {
      this.toast.error('La fecha desde no puede ser posterior a la fecha hasta.');
      return;
    }

    this.loading = true;
    this.hasSearched = true;
    this.reportService.salesReport({
      dateFrom: v.dateFrom,
      dateTo: v.dateTo,
      groupBy: this.groupBy,
      customerId: v.customerId || null,
      installerId: v.installerId || null,
      vehicleId: v.vehicleId || null,
      channel: v.channel ?? null,
      deliveryMode: v.deliveryMode || 'all',
      categoryId: v.categoryId || null,
      saleType: v.saleType || 'all'
    }).subscribe({
      next: res => { this.data = res; this.loading = false; },
      error: (err: { error?: { detail?: string } }) => {
        this.loading = false;
        this.toast.error(err?.error?.detail || 'No se pudo generar el reporte.');
      }
    });
  }

  clearFilters(): void {
    const today = this.toIso(new Date());
    const firstOfMonth = this.toIso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    this.filterForm.reset({ dateFrom: firstOfMonth, dateTo: today, customerId: null, installerId: null, vehicleId: null, channel: null, deliveryMode: 'all', categoryId: null, saleType: 'all' });
    this.advancedFiltersOpen = false;
    this.search();
  }

  money(value: number): string {
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  exportExcel(): void {
    if (!this.data || this.data.rows.length === 0) { this.toast.error('No hay datos para exportar.'); return; }
    const rows = this.data.rows.map(r => {
      const base: Record<string, unknown> = {};
      base[this.dimensionHeader] = r.label;
      if (this.isChannelBrand) base['Marca'] = r.subLabel ?? '';
      base['Ventas'] = r.salesCount;
      base['Unidades'] = r.units;
      base['Facturacion'] = r.revenue;
      base['Costo'] = r.cost;
      base['Ganancia'] = r.profit;
      base['Margen %'] = r.marginPct;
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, this.fileName('xlsx'), { compression: true });
  }

  exportPdf(): void {
    if (!this.data || this.data.rows.length === 0) { this.toast.error('No hay datos para exportar.'); return; }
    const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'landscape' });
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const f = this.filterForm.value;
    let y = 16;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(28, 28, 28);
    doc.text(this.meta.title, margin, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6); doc.setTextColor(108, 108, 108);
    doc.text(`Emitido: ${new Date().toLocaleString('es-AR')}`, pageWidth - margin, y - .2, { align: 'right' });
    y += 5;
    doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
    doc.text(`Desde ${f.dateFrom} hasta ${f.dateTo}`, margin, y);
    y += 7;

    const headers = this.isChannelBrand
      ? [this.dimensionHeader, 'Marca', 'Ventas', 'Unid.', 'Facturacion', 'Costo', 'Ganancia', 'Margen %']
      : [this.dimensionHeader, 'Ventas', 'Unid.', 'Facturacion', 'Costo', 'Ganancia', 'Margen %'];
    const colW = this.isChannelBrand
      ? [50, 40, 22, 22, 35, 35, 35, 24]
      : [80, 24, 24, 40, 40, 40, 28];
    const xs: number[] = []; let cx = margin;
    colW.forEach(w => { xs.push(cx); cx += w; });

    const drawHead = () => {
      doc.setFillColor(235, 232, 225); doc.setDrawColor(206, 202, 192);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 7, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.6); doc.setTextColor(62, 62, 62);
      headers.forEach((h, i) => doc.text(h, xs[i] + 1.5, y + 4.7));
      y += 7;
    };
    drawHead();

    const cellsFor = (r: typeof this.data.rows[number]): string[] => this.isChannelBrand
      ? [r.label, r.subLabel ?? '', String(r.salesCount), String(r.units), this.money(r.revenue), this.money(r.cost), this.money(r.profit), `${r.marginPct}%`]
      : [r.label, String(r.salesCount), String(r.units), this.money(r.revenue), this.money(r.cost), this.money(r.profit), `${r.marginPct}%`];

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(35, 35, 35);
    this.data.rows.forEach((r, idx) => {
      if (y > pageHeight - 16) { doc.addPage(); y = 16; drawHead(); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(35, 35, 35); }
      if (idx % 2 === 0) { doc.setFillColor(249, 248, 245); doc.rect(margin, y, pageWidth - margin * 2, 6, 'F'); }
      const cells = cellsFor(r);
      cells.forEach((c, i) => doc.text(doc.splitTextToSize(c, colW[i] - 2)[0] ?? '', xs[i] + 1.5, y + 4));
      y += 6;
    });

    const t = this.data.totals;
    const totalCells = this.isChannelBrand
      ? ['TOTAL', '', String(t.salesCount), String(t.units), this.money(t.revenue), this.money(t.cost), this.money(t.profit), `${t.marginPct}%`]
      : ['TOTAL', String(t.salesCount), String(t.units), this.money(t.revenue), this.money(t.cost), this.money(t.profit), `${t.marginPct}%`];
    doc.setFont('helvetica', 'bold'); doc.setFillColor(244, 239, 229); doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
    totalCells.forEach((c, i) => doc.text(c, xs[i] + 1.5, y + 4));

    doc.save(this.fileName('pdf'));
  }

  private fileName(ext: string): string {
    const f = this.filterForm.value;
    return `${this.baseTipo}_${f.dateFrom}_${f.dateTo}.${ext}`;
  }

  private toIso(date: Date): string { return date.toLocaleDateString('en-CA'); }
  trackByKey(_: number, r: { key: string; subKey: string | null }): string { return r.subKey ? `${r.key}|${r.subKey}` : r.key; }
}
