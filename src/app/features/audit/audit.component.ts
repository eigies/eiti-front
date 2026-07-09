import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { AuditService } from '../../core/services/audit.service';
import { UserService } from '../../core/services/user.service';
import { ProductService } from '../../core/services/product.service';
import { CustomerService } from '../../core/services/customer.service';
import { SupplierService } from '../../core/services/supplier.service';
import { BranchService } from '../../core/services/branch.service';
import { ToastService } from '../../shared/services/toast.service';
import { AuditLogItem } from '../../core/models/audit.models';
import { UserResponse } from '../../core/models/user.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';
import { PdfBrandingService } from '../../shared/services/pdf-branding.service';
import { PdfLayoutService, PdfTableColumn } from '../../shared/services/pdf-layout.service';

interface PayloadRow {
  label: string;
  value: string;
}

interface ChangeRow {
  label: string;
  before: string;
  after: string;
}

const FIELD_LABELS: Record<string, string> = {
  Id: 'Identificador', Name: 'Nombre', FirstName: 'Nombre', LastName: 'Apellido',
  Code: 'Código', Sku: 'SKU', Brand: 'Marca', Description: 'Descripción', Notes: 'Notas',
  Email: 'Email', Phone: 'Teléfono', TaxId: 'CUIT', DocumentNumber: 'Documento', DocumentType: 'Tipo de documento',
  ProductId: 'Producto', ProductName: 'Producto', PublicPrice: 'Precio público', Price: 'Precio',
  CostPrice: 'Precio de costo', UnitPrice: 'Precio unitario', UnitCost: 'Costo unitario', Quantity: 'Cantidad',
  AllowsManualValueInSale: 'Valor manual en venta', NoDeliverySurcharge: 'Recargo sin envío',
  CustomerId: 'Cliente', BranchId: 'Sucursal', SupplierId: 'Proveedor', UserId: 'Usuario',
  SaleId: 'Venta', PurchaseId: 'Compra', InvoiceNumber: 'Nro. factura', Amount: 'Monto', Date: 'Fecha',
  IdPaymentMethod: 'Medio de pago', Method: 'Medio de pago', Methods: 'Pagos', Payments: 'Pagos',
  Details: 'Productos', GeneralDiscountPercent: 'Descuento general', ManualOverridePrice: 'Precio manual',
  Reference: 'Referencia', IvaPct: 'IVA', IngresosBrutosPct: 'IIBB', Type: 'Tipo de movimiento',
  CardBankId: 'Banco (tarjeta)', CardCuotas: 'Cuotas', Cheque: 'Cheque', BankId: 'Banco',
  Numero: 'Número', Titular: 'Titular', CuitDni: 'CUIT/DNI', Monto: 'Monto',
  FechaEmision: 'Emisión', FechaVencimiento: 'Vencimiento', Address: 'Dirección', Street: 'Calle',
  StreetNumber: 'Número', PostalCode: 'CP', City: 'Ciudad', StateOrProvince: 'Provincia',
  Country: 'País', Floor: 'Piso', Apartment: 'Depto', IsActive: 'Activo', ProfileId: 'Perfil'
};

const HIDDEN_FIELDS = new Set(['CashDrawerId', 'GroupId', 'CompanyId']);
const ID_FIELDS = new Set(['ProductId', 'CustomerId', 'SupplierId', 'BranchId', 'SaleId', 'PurchaseId', 'UserId', 'Id']);
const EXPORT_IDENTIFIER_FIELDS = ['Code', 'SaleId', 'PurchaseId', 'Id', 'InvoiceNumber', 'ProductId', 'CustomerId', 'SupplierId', 'BranchId', 'UserId'];

const SALE_PAYMENT_METHODS: Record<number, string> = { 1: 'Efectivo', 2: 'Transferencia', 3: 'Tarjeta', 4: 'Cheque', 5: 'Otros', 6: 'Saldo a favor' };
const PURCHASE_PAYMENT_METHODS: Record<number, string> = { 1: 'Efectivo', 2: 'Transferencia', 3: 'Cheque', 4: 'Otro', 5: 'Saldo a favor' };
const DOCUMENT_TYPES: Record<number, string> = { 1: 'DNI', 2: 'Pasaporte', 3: 'LE', 4: 'LC', 5: 'Otro' };
const STOCK_MOVEMENT_TYPES: Record<number, string> = {
  1: 'Entrada manual', 2: 'Ajuste manual', 3: 'Reserva', 4: 'Liberar reserva', 5: 'Salida por venta',
  6: 'Canje (ingreso)', 7: 'Devolución de venta', 8: 'Ingreso por compra', 9: 'Devolución de compra'
};

const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T|$)/;

const ACTION_LABELS: Record<string, string> = {
  CreateSaleCommand: 'Venta creada',
  UpdateSaleCommand: 'Venta editada',
  DeleteSaleCommand: 'Venta eliminada',
  CancelSaleCommand: 'Venta cancelada',
  CreateCcSaleCommand: 'Venta cuenta corriente creada',
  AddCcPaymentCommand: 'Pago cuenta corriente',
  AddCcPaymentGroupCommand: 'Pago cuenta corriente (grupo)',
  CancelCcPaymentCommand: 'Pago cuenta corriente cancelado',
  SendSaleWhatsAppCommand: 'Venta enviada por WhatsApp',
  CreateProductCommand: 'Producto creado',
  UpdateProductCommand: 'Producto editado',
  DeleteProductCommand: 'Producto eliminado',
  AdjustStockCommand: 'Ajuste de stock',
  CreatePurchaseCommand: 'Compra creada',
  AddPurchasePaymentCommand: 'Pago de compra',
  CancelPurchaseCommand: 'Compra cancelada',
  CancelPurchasePaymentCommand: 'Pago de compra cancelado',
  OpenCashSessionCommand: 'Apertura de caja',
  CloseCashSessionCommand: 'Cierre de caja',
  CreateCashWithdrawalCommand: 'Retiro de caja',
  CreateCashDepositCommand: 'Ingreso de caja',
  CreateCashTransferCommand: 'Transferencia de caja',
  CreateCashDrawerCommand: 'Caja creada',
  UpdateCashDrawerCommand: 'Caja editada',
  CreateCustomerCommand: 'Cliente creado',
  UpdateCustomerCommand: 'Cliente editado',
  CreateBranchCommand: 'Sucursal creada',
  UpdateBranchCommand: 'Sucursal editada',
  CreateSupplierCommand: 'Proveedor creado',
  UpdateSupplierCommand: 'Proveedor editado',
  DeactivateSupplierCommand: 'Proveedor desactivado',
  CreateBankCommand: 'Banco creado',
  UpdateBankCommand: 'Banco editado',
  UpsertInstallmentPlanCommand: 'Plan de cuotas actualizado',
  UpdateChequeStatusCommand: 'Estado de cheque actualizado',
  CreateUserCommand: 'Usuario creado',
  UpdateUserProfileCommand: 'Perfil de usuario actualizado',
  SetUserActiveStatusCommand: 'Estado de usuario actualizado',
  CreateEmployeeCommand: 'Empleado creado',
  UpdateEmployeeCommand: 'Empleado editado',
  CreateSaleTransportCommand: 'Transporte asignado',
  UpdateSaleTransportCommand: 'Transporte editado',
  UpdateSaleTransportStatusCommand: 'Estado de transporte actualizado',
  DeleteSaleTransportCommand: 'Transporte quitado',
  RegisterCommand: 'Registro de cuenta',
  ResetPasswordCommand: 'Restablecimiento de contraseña',
  RequestPasswordResetCommand: 'Solicitud de restablecimiento'
};

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
  templateUrl: './audit.component.html',
  styleUrls: ['./audit.component.css']
})
export class AuditComponent implements OnInit {
  filterForm: FormGroup;
  users: UserResponse[] = [];
  items: AuditLogItem[] = [];
  loading = false;
  hasSearched = false;

  page = 1;
  pageSize = 25;
  totalCount = 0;
  totalPages = 1;

  expandedId: string | null = null;
  rawVisibleId: string | null = null;

  private readonly idNameMap = new Map<string, string>();

  readonly pageSizeOptions = [25, 50, 100, 200];

  constructor(
    private readonly fb: FormBuilder,
    private readonly auditService: AuditService,
    private readonly userService: UserService,
    private readonly productService: ProductService,
    private readonly customerService: CustomerService,
    private readonly supplierService: SupplierService,
    private readonly branchService: BranchService,
    private readonly toast: ToastService,
    private readonly pdfBranding: PdfBrandingService,
    private readonly pdfLayout: PdfLayoutService
  ) {
    const today = this.toIso(new Date());
    const firstOfMonth = this.toIso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    this.filterForm = this.fb.group({
      userId: [null],
      dateFrom: [firstOfMonth, Validators.required],
      dateTo: [today, Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadUsers();
    this.loadCatalogs();
    this.search();
  }

  get userOptions(): SearchableSelectOption[] {
    return this.users.map(user => ({ value: user.id, label: user.username }));
  }

  isInvalid(field: string): boolean {
    const control = this.filterForm.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  private loadUsers(): void {
    this.userService.listUsers().subscribe({
      next: users => {
        this.users = users;
        users.forEach(u => this.idNameMap.set(u.id.toLowerCase(), u.username));
      },
      error: () => {}
    });
  }

  // Carga catálogos para traducir los IDs del payload a nombres reales.
  private loadCatalogs(): void {
    forkJoin({
      products: this.productService.listProducts().pipe(catchError(() => of([]))),
      customers: this.customerService.listCustomers().pipe(catchError(() => of([]))),
      suppliers: this.supplierService.listSuppliers(undefined, false).pipe(catchError(() => of([]))),
      branches: this.branchService.listBranches().pipe(catchError(() => of([])))
    }).subscribe(({ products, customers, suppliers, branches }) => {
      products.forEach(p => this.idNameMap.set(p.id.toLowerCase(), p.code ? `${p.name} (${p.code})` : p.name));
      customers.forEach(c => this.idNameMap.set(c.id.toLowerCase(), c.fullName || 'Cliente'));
      suppliers.forEach(s => this.idNameMap.set(s.id.toLowerCase(), s.name));
      branches.forEach(b => this.idNameMap.set(b.id.toLowerCase(), b.name));
    });
  }

  search(resetPage = true): void {
    if (this.filterForm.invalid) {
      this.filterForm.markAllAsTouched();
      this.toast.error('Las fechas desde y hasta son obligatorias.');
      return;
    }

    const value = this.filterForm.value;
    if (value.dateFrom > value.dateTo) {
      this.toast.error('La fecha desde no puede ser posterior a la fecha hasta.');
      return;
    }

    if (resetPage) {
      this.page = 1;
    }

    this.loading = true;
    this.hasSearched = true;
    this.auditService.listAuditLog({
      dateFrom: value.dateFrom,
      dateTo: value.dateTo,
      userId: value.userId || null,
      page: this.page,
      pageSize: this.pageSize
    }).subscribe({
      next: response => {
        this.items = response.items;
        this.page = response.page;
        this.pageSize = response.pageSize;
        this.totalCount = response.totalCount;
        this.totalPages = response.totalPages;
        this.expandedId = null;
        this.loading = false;
      },
      error: (err: unknown) => {
        this.loading = false;
        const e = err as { error?: { detail?: string } };
        this.toast.error(e?.error?.detail || 'No se pudo cargar la auditoría.');
      }
    });
  }

  clearFilters(): void {
    const today = this.toIso(new Date());
    const firstOfMonth = this.toIso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    this.filterForm.reset({ userId: null, dateFrom: firstOfMonth, dateTo: today });
    this.search();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) {
      return;
    }
    this.page = page;
    this.search(false);
  }

  changePageSize(size: number): void {
    if (size === this.pageSize) {
      return;
    }
    this.pageSize = size;
    this.search();
  }

  toggleDetail(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  actionLabel(actionType: string): string {
    if (ACTION_LABELS[actionType]) {
      return ACTION_LABELS[actionType];
    }
    return actionType
      .replace(/Command$/, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();
  }

  prettyPayload(payloadJson: string | null): string {
    if (!payloadJson) {
      return 'Sin datos.';
    }
    try {
      return JSON.stringify(JSON.parse(payloadJson), null, 2);
    } catch {
      return payloadJson;
    }
  }

  toggleRaw(id: string): void {
    this.rawVisibleId = this.rawVisibleId === id ? null : id;
  }

  // Convierte el payload (JSON técnico) en una lista legible: traduce nombres de
  // campos, formatea valores (plata, fechas, sí/no, medios de pago) y resuelve los
  // IDs a los nombres reales de producto/cliente/proveedor/sucursal/usuario.
  humanizeRows(item: AuditLogItem): PayloadRow[] {
    const obj = this.parseJsonObject(item.payloadJson);
    if (!obj || typeof obj !== 'object') {
      return [];
    }
    return this.objectToRows(obj as Record<string, unknown>, item.actionType);
  }

  snapshotRows(item: AuditLogItem, state: 'before' | 'after'): PayloadRow[] {
    const obj = this.parseJsonObject(state === 'before' ? item.beforeJson : item.afterJson);
    if (!obj || typeof obj !== 'object') {
      return [];
    }
    return this.objectToRows(obj as Record<string, unknown>, item.actionType);
  }

  changeRows(item: AuditLogItem): ChangeRow[] {
    const before = this.parseJsonObject(item.beforeJson);
    const after = this.parseJsonObject(item.afterJson);

    if (!before && !after) {
      return [];
    }

    const keys = new Set<string>([
      ...Object.keys(before ?? {}),
      ...Object.keys(after ?? {})
    ]);
    const rows: ChangeRow[] = [];

    keys.forEach(key => {
      if (HIDDEN_FIELDS.has(key)) {
        return;
      }

      const beforeValue = before?.[key];
      const afterValue = after?.[key];
      if (this.valuesEqual(beforeValue, afterValue)) {
        return;
      }

      rows.push({
        label: this.fieldLabel(key),
        before: this.formatChangeValue(key, beforeValue, item.actionType),
        after: this.formatChangeValue(key, afterValue, item.actionType)
      });
    });

    return rows;
  }

  private objectToRows(obj: Record<string, unknown>, actionType: string): PayloadRow[] {
    const rows: PayloadRow[] = [];
    for (const key of Object.keys(obj)) {
      if (HIDDEN_FIELDS.has(key)) {
        continue;
      }
      const value = this.formatValue(key, obj[key], actionType);
      if (value === null || value === '') {
        continue;
      }
      rows.push({ label: this.fieldLabel(key), value });
    }
    return rows;
  }

  private fieldLabel(key: string): string {
    return FIELD_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  private formatValue(key: string, value: unknown, actionType: string): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }

    if (typeof value === 'string') {
      if (GUID_RE.test(value)) {
        const name = this.idNameMap.get(value.toLowerCase());
        if (name) {
          return name;
        }
        return ID_FIELDS.has(key) ? '(no disponible)' : null;
      }
      if (this.isDateField(key) || ISO_DATE_RE.test(value)) {
        return this.formatDateValue(value);
      }
      return value;
    }

    if (typeof value === 'number') {
      if (this.isEnumField(key)) {
        return this.enumLabel(key, value, actionType);
      }
      if (/(Pct|Percent)$/.test(key)) {
        return `${value}%`;
      }
      if (this.isMoneyField(key)) {
        return `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return String(value);
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return null;
      }
      if (typeof value[0] !== 'object' || value[0] === null) {
        return value.join(', ');
      }
      return value
        .map(v => '• ' + this.summarizeObject(v as Record<string, unknown>, actionType))
        .join('\n');
    }

    if (typeof value === 'object') {
      return this.summarizeObject(value as Record<string, unknown>, actionType);
    }

    return String(value);
  }

  private summarizeObject(obj: Record<string, unknown>, actionType: string): string {
    return Object.keys(obj)
      .filter(k => !HIDDEN_FIELDS.has(k))
      .map(k => {
        const formatted = this.formatValue(k, obj[k], actionType);
        return formatted === null ? null : `${this.fieldLabel(k)}: ${formatted}`;
      })
      .filter((x): x is string => x !== null)
      .join(' · ');
  }

  private isMoneyField(key: string): boolean {
    return /(Amount|Cost|Price|Total|Surcharge|Monto|Saldo|Override)/i.test(key) && !/(Pct|Percent)$/.test(key);
  }

  private isDateField(key: string): boolean {
    return /(Date|Fecha)/i.test(key);
  }

  private isEnumField(key: string): boolean {
    return key === 'IdPaymentMethod' || key === 'Method' || key === 'Type' || key === 'DocumentType';
  }

  private enumLabel(key: string, value: number, actionType: string): string {
    if (key === 'DocumentType') {
      return DOCUMENT_TYPES[value] ?? String(value);
    }
    if (key === 'Type') {
      return STOCK_MOVEMENT_TYPES[value] ?? String(value);
    }
    // IdPaymentMethod / Method
    const map = actionType.includes('Purchase') ? PURCHASE_PAYMENT_METHODS : SALE_PAYMENT_METHODS;
    return map[value] ?? String(value);
  }

  private formatDateValue(value: string): string {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return value;
    }
    const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
    return date.toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {})
    });
  }

  exportExcel(): void {
    if (this.items.length === 0) {
      this.toast.error('No hay registros para exportar.');
      return;
    }

    const rows = this.items.map(item => ({
      'Fecha/hora': this.formatDateTime(item.timestamp),
      'Usuario': item.userName || (item.userId ? item.userId : 'Sistema'),
      'Acción': this.actionLabel(item.actionType),
      'Acción (técnica)': item.actionType,
      'Resultado': item.succeeded ? 'OK' : 'Error',
      'Código error': item.errorCode || '',
      'Identificador': this.rowIdentifier(item),
      'Cambios': this.exportChangeSummary(item)
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Auditoria');
    XLSX.writeFile(workbook, this.exportFileName('xlsx'), { compression: true });
  }

  async exportPdf(): Promise<void> {
    if (this.items.length === 0) {
      this.toast.error('No hay registros para exportar.');
      return;
    }

    const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'landscape' });
    const branding = await this.pdfBranding.prepare();
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxY = pageHeight - 14;
    const title = 'Reporte de auditoria';
    const f = this.filterForm.value;
    let y = 16;

    const tableWidth = pageWidth - margin * 2;
    const columns = this.pdfLayout.resolveColumns(margin, [
      { header: 'Fecha / hora', width: 32 },
      { header: 'Usuario', width: 46 },
      { header: 'Accion', width: 94 },
      { header: 'Resultado', width: 28 },
      { header: 'Identificador / cambios', width: tableWidth - 200 }
    ] satisfies PdfTableColumn[]);
    const [dateCol, userCol, actionCol, resultCol, detailCol] = columns;

    const drawDocumentHeader = (continuation = false): void => {
      this.pdfBranding.drawWatermark(doc, branding, pageWidth, pageHeight);
      y = this.pdfBranding.drawHeader(doc, branding, {
        title,
        subtitle: `Reporteria / Auditoria - ${f.dateFrom} a ${f.dateTo}`,
        continuation,
        margin,
        y: 12,
        pageWidth
      });
      doc.setFillColor(244, 239, 229);
      doc.setDrawColor(221, 206, 180);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 8, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.6);
      doc.setTextColor(120, 88, 33);
      doc.text('Historial de acciones de los usuarios: cada fila es un evento registrado con su resultado y detalle.', margin + 3, y + 5.1);
      y += 12;
    };

    const drawSummary = (): void => {
      const cardGap = 4;
      const cardWidth = (pageWidth - margin * 2 - cardGap * 3) / 4;
      this.drawMetricCard(doc, margin, y, cardWidth, 'Registros', `${this.items.length} de ${this.totalCount}`, 'accent');
      this.drawMetricCard(doc, margin + cardWidth + cardGap, y, cardWidth, 'Desde', f.dateFrom, 'neutral');
      this.drawMetricCard(doc, margin + (cardWidth + cardGap) * 2, y, cardWidth, 'Hasta', f.dateTo, 'neutral');
      this.drawMetricCard(doc, margin + (cardWidth + cardGap) * 3, y, cardWidth, 'Usuario', this.userFilterLabel(), 'neutral');
      y += 17;
    };

    const drawTableHeader = (): void => {
      y = this.pdfLayout.drawTableHeader(doc, columns, y, { tableWidth, fontSize: 7.7 });
    };

    drawDocumentHeader();
    drawSummary();
    drawTableHeader();

    for (let rowIndex = 0; rowIndex < this.items.length; rowIndex += 1) {
      const item = this.items[rowIndex];
      const userLabel = item.userName || (item.userId ? item.userId.slice(0, 8) : 'Sistema');
      const changeSummary = this.exportChangeSummary(item);
      const detail = item.succeeded
        ? `${this.rowIdentifier(item)}${changeSummary === '-' ? '' : ' / ' + changeSummary}`
        : (item.errorCode || 'Error');

      const values = [
        this.formatDateTime(item.timestamp),
        userLabel,
        this.actionLabel(item.actionType),
        item.succeeded ? 'OK' : 'Error',
        detail
      ];
      const rowOptions = { tableWidth, wrap: true, minHeight: 8.2, lineHeight: 3.4, maxLines: 2, fontSize: 7.9 };
      const rowHeight = this.pdfLayout.measureTableRowHeight(doc, columns, values, rowOptions);

      y = this.pdfLayout.ensurePageSpace(doc, y, rowHeight, pageHeight, () => {
        drawDocumentHeader(true);
        drawTableHeader();
        return y;
      }, 14);

      this.pdfLayout.drawTableRowBackground(doc, margin, y, tableWidth, rowHeight, { alternate: rowIndex % 2 === 0 });
      this.pdfLayout.drawTableSeparator(doc, margin, y + rowHeight, tableWidth);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.9);
      doc.setTextColor(35, 35, 35);
      doc.text(this.pdfLayout.splitCellText(doc, values[0], dateCol, 2), dateCol.x + 1.5, y + 4.8);
      doc.text(this.pdfLayout.splitCellText(doc, values[1], userCol, 2), userCol.x + 1.5, y + 4.8);
      doc.text(this.pdfLayout.splitCellText(doc, values[2], actionCol, 2), actionCol.x + 1.5, y + 4.8);

      if (item.succeeded) {
        doc.setTextColor(34, 120, 58);
      } else {
        doc.setTextColor(178, 52, 52);
      }
      doc.text(values[3], resultCol.x + 1.5, y + 4.8);

      doc.setTextColor(90, 90, 90);
      doc.text(this.pdfLayout.splitCellText(doc, values[4], detailCol, 2), detailCol.x + 1.5, y + 4.8);

      y += rowHeight;
    }

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(125, 125, 125);
      doc.text(`Pagina ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    doc.save(this.exportFileName('pdf'));
  }

  private drawMetricCard(
    doc: jsPDF,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    tone: 'neutral' | 'accent' = 'neutral'
  ): void {
    if (tone === 'accent') {
      doc.setFillColor(244, 239, 229);
      doc.setDrawColor(221, 206, 180);
    } else {
      doc.setFillColor(245, 245, 244);
      doc.setDrawColor(220, 220, 218);
    }

    doc.roundedRect(x, y, width, 13, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(112, 112, 112);
    doc.text(label.toUpperCase(), x + 2.5, y + 4.4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(36, 36, 36);
    const valueLine = (doc.splitTextToSize(value, width - 5) as string[])[0] ?? value;
    doc.text(valueLine, x + 2.5, y + 9.7);
  }

  private userFilterLabel(): string {
    const userId = this.filterForm.value.userId;
    if (!userId) {
      return 'Todos';
    }
    return this.users.find(user => user.id === userId)?.username ?? 'Usuario';
  }

  private exportFileName(ext: string): string {
    const f = this.filterForm.value;
    return `auditoria_${f.dateFrom}_${f.dateTo}.${ext}`;
  }

  private exportChangeSummary(item: AuditLogItem): string {
    const changes = this.changeRows(item);
    if (changes.length === 0) {
      return '-';
    }

    return changes
      .slice(0, 6)
      .map(change => `${change.label}: ${change.before} -> ${change.after}`)
      .join(' | ');
  }

  // Identificador legible de la fila (código de venta/compra/producto, etc.) para
  // mostrar en la tabla sin tener que abrir el detalle. Misma resolución que usan
  // las exportaciones, para no duplicar lógica.
  rowIdentifier(item: AuditLogItem): string {
    const payload = this.parseJsonObject(item.afterJson)
      ?? this.parseJsonObject(item.beforeJson)
      ?? this.parseJsonObject(item.payloadJson);

    if (payload) {
      for (const key of EXPORT_IDENTIFIER_FIELDS) {
        const value = payload[key];
        const formatted = this.formatExportIdentifierValue(key, value, item.actionType);
        if (formatted) {
          return formatted;
        }
      }
    }

    return '-';
  }

  private formatExportIdentifierValue(key: string, value: unknown, actionType: string): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'string') {
      if (GUID_RE.test(value)) {
        const name = this.idNameMap.get(value.toLowerCase());
        return name || value;
      }
      return value;
    }

    if (typeof value === 'number') {
      return this.isEnumField(key)
        ? this.enumLabel(key, value, actionType)
        : String(value);
    }

    return null;
  }

  private parseJsonObject(json: string | null): Record<string, unknown> | null {
    if (!json) {
      return null;
    }

    try {
      const parsed = JSON.parse(json) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }

  private valuesEqual(left: unknown, right: unknown): boolean {
    return this.stableValue(left) === this.stableValue(right);
  }

  private stableValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    if (Array.isArray(value)) {
      return JSON.stringify(value.map(item => this.stableValue(item)));
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      return JSON.stringify(Object.keys(obj).sort().map(key => [key, this.stableValue(obj[key])]));
    }

    return String(value);
  }

  private formatChangeValue(key: string, value: unknown, actionType: string): string {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    const formatted = this.formatValue(key, value, actionType);
    return formatted || '-';
  }

  private formatDateTime(value: string): string {
    const date = new Date(value);
    return date.toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }

  private toIso(date: Date): string {
    return date.toLocaleDateString('en-CA');
  }

  trackById(_: number, item: AuditLogItem): string {
    return item.id;
  }
}
