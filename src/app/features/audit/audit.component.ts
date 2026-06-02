import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { AuditService } from '../../core/services/audit.service';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../shared/services/toast.service';
import { AuditLogItem } from '../../core/models/audit.models';
import { UserResponse } from '../../core/models/user.models';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';

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

  readonly pageSizeOptions = [25, 50, 100, 200];

  constructor(
    private readonly fb: FormBuilder,
    private readonly auditService: AuditService,
    private readonly userService: UserService,
    private readonly toast: ToastService
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
      next: users => this.users = users,
      error: () => {}
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
      'Detalle': item.payloadJson || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Auditoria');
    XLSX.writeFile(workbook, this.exportFileName('xlsx'), { compression: true });
  }

  exportPdf(): void {
    if (this.items.length === 0) {
      this.toast.error('No hay registros para exportar.');
      return;
    }

    const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'landscape' });
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxY = pageHeight - 14;
    const title = 'Reporte de auditoria';
    const f = this.filterForm.value;
    let y = 16;

    const cols = {
      date: { x: margin + 2, width: 30 },
      user: { x: margin + 34, width: 44 },
      action: { x: margin + 80, width: 92 },
      result: { x: margin + 174, width: 26 },
      detail: { x: margin + 202, width: pageWidth - margin - (margin + 202) }
    };

    const drawDocumentHeader = (continuation = false): void => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(28, 28, 28);
      doc.text(continuation ? `${title} / Continuacion` : title, margin, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.6);
      doc.setTextColor(108, 108, 108);
      doc.text(`Emitido: ${new Date().toLocaleString('es-AR')}`, pageWidth - margin, y - .2, { align: 'right' });
      y += 3.5;

      doc.setFontSize(8);
      doc.setTextColor(132, 132, 132);
      doc.text('Reporteria / Auditoria', margin, y + 1.5);
      y += 4.5;

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
      doc.setFillColor(235, 232, 225);
      doc.setDrawColor(206, 202, 192);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 7, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.7);
      doc.setTextColor(62, 62, 62);
      doc.text('Fecha / hora', cols.date.x, y + 4.7);
      doc.text('Usuario', cols.user.x, y + 4.7);
      doc.text('Accion', cols.action.x, y + 4.7);
      doc.text('Resultado', cols.result.x, y + 4.7);
      doc.text('Detalle', cols.detail.x, y + 4.7);
      y += 7;
    };

    drawDocumentHeader();
    drawSummary();
    drawTableHeader();

    for (let rowIndex = 0; rowIndex < this.items.length; rowIndex += 1) {
      const item = this.items[rowIndex];
      const userLabel = item.userName || (item.userId ? item.userId.slice(0, 8) : 'Sistema');
      const detail = item.succeeded ? (item.payloadJson ?? '-') : (item.errorCode || 'Error');

      const userLines = doc.splitTextToSize(userLabel, cols.user.width) as string[];
      const actionLines = doc.splitTextToSize(this.actionLabel(item.actionType), cols.action.width) as string[];
      const detailLines = (doc.splitTextToSize(detail, cols.detail.width) as string[]).slice(0, 2);
      const rowHeight = Math.max(
        8.2,
        userLines.length * 3.4 + 2.4,
        actionLines.length * 3.4 + 2.4,
        detailLines.length * 3.4 + 2.4
      );

      if (y + rowHeight > maxY) {
        doc.addPage();
        y = 16;
        drawDocumentHeader(true);
        drawTableHeader();
      }

      if (rowIndex % 2 === 0) {
        doc.setFillColor(249, 248, 245);
        doc.rect(margin, y, pageWidth - margin * 2, rowHeight, 'F');
      }

      doc.setDrawColor(228, 228, 226);
      doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.9);
      doc.setTextColor(35, 35, 35);
      doc.text(this.formatDateTime(item.timestamp), cols.date.x, y + 4.8);
      doc.text(userLines, cols.user.x, y + 4.8);
      doc.text(actionLines, cols.action.x, y + 4.8);

      if (item.succeeded) {
        doc.setTextColor(34, 120, 58);
      } else {
        doc.setTextColor(178, 52, 52);
      }
      doc.text(item.succeeded ? 'OK' : 'Error', cols.result.x, y + 4.8);

      doc.setTextColor(90, 90, 90);
      doc.text(detailLines, cols.detail.x, y + 4.8);

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
