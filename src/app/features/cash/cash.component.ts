import { Component, OnInit } from '@angular/core';
import { formatMoney } from '../../shared/utils/money.util';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BranchService } from '../../core/services/branch.service';
import { CashService } from '../../core/services/cash.service';
import { BranchResponse } from '../../core/models/branch.models';
import { CashDrawerResponse, CashSessionMovementResponse, CashSessionResponse, CashSessionSummaryResponse, PaymentMethodBreakdownItem } from '../../core/models/cash.models';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmationService } from '../../shared/services/confirmation.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { OnboardingStatusResponse } from '../../core/models/onboarding.models';
import { OnboardingBannerComponent } from '../../shared/components/onboarding-banner/onboarding-banner.component';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { AuthService } from '../../core/services/auth.service';
import { PermissionCodes } from '../../core/models/permission.models';
import { SaleService } from '../../core/services/sale.service';
import { SaleByIdResponse, SaleResponse } from '../../core/models/sale.models';
import { CustomerAccount, CustomerAccountMovement, CustomerPaymentImputacion, CustomerPaymentLink } from '../../core/models/customer-account.models';
import { CustomerAccountService } from '../../core/services/customer-account.service';
import { PurchaseService } from '../../core/services/purchase.service';
import { PurchaseDetailResponse } from '../../core/models/purchase.models';
import { SALE_PAYMENT_METHODS, paymentMethodSummary } from '../../core/models/sale-payment.models';
import { BankService } from '../../core/services/bank.service';
import { BankResponse } from '../../core/models/bank.models';
import { forkJoin } from 'rxjs';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';
import { PdfBrandingService } from '../../shared/services/pdf-branding.service';
import { PdfLayoutService, PdfTableColumn } from '../../shared/services/pdf-layout.service';
import { PaymentReceiptPdfService, PaymentReceiptData } from '../../shared/services/payment-receipt-pdf.service';

type CashSessionView = {
    session: CashSessionResponse;
    expanded: boolean;
    salesIncome: number;
    manualDeposits: number;
    withdrawals: number;
    expectedClosingAmount: number;
};

type CashDisplayRow = {
    occurredAt: string;
    typeName: string;
    directionName: string;
    amount: number;
    paymentMethodLabel: string;
    description: string | null | undefined;
    referenceType?: string | null;
    referenceId: string | null;
    saleCode: string | null;
    username: string | null;
    originalCashSessionId?: string | null;
    customerPaymentId?: string | null;
};

@Component({
    selector: 'app-cash',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, OnboardingBannerComponent, SearchableSelectComponent],
    templateUrl: './cash.component.html',
    styleUrls: ['./cash.component.css']
})
export class CashComponent implements OnInit {
    readonly permissionCodes = PermissionCodes;
    drawerForm: FormGroup;
    openForm: FormGroup;
    withdrawForm: FormGroup;
    depositForm: FormGroup;
    closeForm: FormGroup;
    transferForm: FormGroup;
    submittingTransfer = false;
    showWithdrawModal = false;
    showDepositModal = false;
    showTransferModal = false;
    showCloseConfirmModal = false;
    showPendingCloseSalesModal = false;
    checkingPendingCloseSales = false;
    branches: BranchResponse[] = [];
    drawers: CashDrawerResponse[] = [];
    selectedBranchId = '';
    selectedDrawerId = '';
    currentSession: CashSessionResponse | null = null;
    currentSummary: CashSessionSummaryResponse | null = null;
    historySessions: CashSessionView[] = [];
    salePaymentMethodsBySaleId = new Map<string, string>();
    salesBySaleId = new Map<string, SaleResponse>();
    bankNamesById = new Map<number, string>();
    ccSalesBySaleId = new Map<string, SaleByIdResponse>();
    ccPopupSaleId: string | null = null;
    ccPopupPayments: import('../../core/models/sale.models').CcPaymentResponse[] = [];
    ccPopupLoading = false;
    customerPaymentPopupId: string | null = null;
    customerPaymentPopupLink: CustomerPaymentLink | null = null;
    customerPaymentPopupAccount: CustomerAccount | null = null;
    customerPaymentPopupMovement: CustomerAccountMovement | null = null;
    customerPaymentPopupLoading = false;
    cancelDetailPopupRow: CashDisplayRow | null = null;
    purchasePopupId: string | null = null;
    purchasePopupData: PurchaseDetailResponse | null = null;
    purchasePopupLoading = false;
    pendingCloseSales: SaleResponse[] = [];
    historyFrom = '';
    historyTo = '';
    showCreateDrawer = false;
    loadingSession = false;
    // Cierre de la ultima sesion de esta caja: es lo que precarga el monto inicial y contra lo
    // que se contrasta al confirmar la apertura. null = no se pudo obtener.
    suggestedOpeningAmount: number | null = null;
    loadingSuggestedOpening = false;
    loadingHistory = false;
    onboardingStatus: OnboardingStatusResponse | null = null;

    constructor(
        private fb: FormBuilder,
        private branchService: BranchService,
        private cashService: CashService,
        private saleService: SaleService,
        private customerAccountService: CustomerAccountService,
        private bankService: BankService,
        private purchaseService: PurchaseService,
        private toast: ToastService,
        private confirmation: ConfirmationService,
        private onboardingService: OnboardingService,
        private router: Router,
        private pdfBranding: PdfBrandingService,
        private pdfLayout: PdfLayoutService,
        private paymentReceiptPdf: PaymentReceiptPdfService,
        public auth: AuthService
    ) {
        this.drawerForm = this.fb.group({ name: ['', Validators.required] });
        this.openForm = this.fb.group({ openingAmount: [0, [Validators.required, Validators.min(0)]], notes: [''] });
        this.withdrawForm = this.fb.group({ amount: [0, [Validators.required, Validators.min(0.01)]], description: ['', Validators.required] });
        this.depositForm = this.fb.group({ amount: [0, [Validators.required, Validators.min(0.01)]], description: ['', Validators.required] });
        this.closeForm = this.fb.group({ actualClosingAmount: [0, [Validators.required, Validators.min(0)]], notes: [''] });
        this.transferForm = this.fb.group({ targetCashDrawerId: ['', Validators.required], amount: [0, [Validators.required, Validators.min(0.01)]], description: ['', Validators.required] });
    }

    ngOnInit(): void {
        this.refreshOnboarding();
        this.loadBranches();
        this.bankService.listBanks(false, 'all').subscribe({
            next: banks => {
                this.bankNamesById = new Map(banks.map((b: BankResponse) => [b.id, b.name]));
            }
        });
    }

    get showCashDrawerOnboarding(): boolean {
        return !!this.onboardingStatus && !this.onboardingStatus.isCompleted && this.onboardingStatus.nextStep === 'CashDrawer';
    }

    get showInitialCashOpenOnboarding(): boolean {
        return !!this.onboardingStatus && !this.onboardingStatus.isCompleted && this.onboardingStatus.nextStep === 'InitialCashOpen';
    }

    get cashDrawerFocusLocked(): boolean {
        return this.showCashDrawerOnboarding && !this.onboardingService.isStepAccepted('CashDrawer');
    }

    get initialCashOpenFocusLocked(): boolean {
        return this.showInitialCashOpenOnboarding && !this.onboardingService.isStepAccepted('InitialCashOpen');
    }

    get isOnboardingFocusLocked(): boolean {
        return this.cashDrawerFocusLocked || this.initialCashOpenFocusLocked;
    }

    get canViewAllCashDrawers(): boolean {
        return this.auth.hasPermission(PermissionCodes.cashDrawerViewAll);
    }

    get isRestrictedToAssignedDrawer(): boolean {
        return !this.canViewAllCashDrawers && !!this.auth.currentUser?.assignedCashDrawerId;
    }

    selectBranch(branchId: string): void {
        this.selectedBranchId = branchId;
        this.selectedDrawerId = '';
        this.showCreateDrawer = false;
        this.currentSession = null;
        this.currentSummary = null;
        this.historySessions = [];
        this.historyFrom = '';
        this.historyTo = '';
        this.loadingHistory = false;
        this.drawers = [];

        if (!branchId) {
            return;
        }

        this.cashService.listCashDrawers(branchId).subscribe({
            next: drawers => {
                this.drawers = drawers;

                if (!this.selectedDrawerId && drawers.length > 0) {
                    const assignedDrawerId = this.auth.currentUser?.assignedCashDrawerId;
                    const autoSelectedDrawer = this.isRestrictedToAssignedDrawer
                        ? drawers.find(drawer => drawer.id === assignedDrawerId) ?? drawers[0]
                        : drawers.length === 1 || this.showCashDrawerOnboarding || this.showInitialCashOpenOnboarding
                            ? drawers[0]
                            : null;

                    if (autoSelectedDrawer) {
                        this.selectDrawer(autoSelectedDrawer.id);
                    }
                }
            },
            error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar las cajas')
        });
    }

    createDrawer(): void {
        if (!this.selectedBranchId || this.drawerForm.invalid) {
            this.drawerForm.markAllAsTouched();
            return;
        }

        this.cashService.createCashDrawer(this.selectedBranchId, this.drawerForm.get('name')?.value).subscribe({
            next: drawer => {
                this.drawers = [...this.drawers, drawer];
                this.selectedDrawerId = drawer.id;
                this.drawerForm.reset({ name: '' });
                this.showCreateDrawer = false;
                this.loadCurrentSession();
                this.loadHistory();
                this.toast.success('Caja creada');
                this.refreshOnboarding(true);
            },
            error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo crear la caja')
        });
    }

    toggleCreateDrawer(): void {
        if (!this.selectedBranchId) {
            return;
        }

        this.showCreateDrawer = !this.showCreateDrawer;
        if (!this.showCreateDrawer) {
            this.drawerForm.reset({ name: '' });
        }
    }

    cancelCreateDrawer(): void {
        this.showCreateDrawer = false;
        this.drawerForm.reset({ name: '' });
    }

    selectDrawer(drawerId: string): void {
        this.selectedDrawerId = drawerId;
        this.loadCurrentSession();
        this.loadHistory();
    }

    async openSession(): Promise<void> {
        if (!this.selectedDrawerId || this.openForm.invalid) {
            this.openForm.markAllAsTouched();
            return;
        }

        const { openingAmount, notes } = this.openForm.getRawValue();
        const amount = Number(openingAmount);
        const suggested = this.suggestedOpeningAmount;
        // El monto sugerido puede no haber llegado todavia (o haber fallado). Confirmar con el
        // numero a la vista obliga a mirarlo antes de abrir en un valor que no corresponde.
        const mismatch = suggested !== null && suggested !== amount;

        const confirmed = await this.confirmation.confirm({
            title: 'Abrir caja',
            message: `Vas a abrir la caja con un monto inicial de $ ${this.formatCurrency(amount)}.`,
            detail: mismatch
                ? `Atencion: el cierre anterior de esta caja fue de $ ${this.formatCurrency(suggested!)}. Si el monto inicial no coincide, revisalo antes de continuar.`
                : this.loadingSuggestedOpening
                    ? 'Todavia se esta consultando el cierre anterior. Confirma solo si el monto es el correcto.'
                    : undefined,
            confirmLabel: 'Abrir caja',
            tone: mismatch || this.loadingSuggestedOpening ? 'warning' : 'neutral'
        });

        if (!confirmed) {
            return;
        }

        const source = this.showInitialCashOpenOnboarding
            ? this.onboardingService.completeInitialCashOpen(this.selectedDrawerId, Number(openingAmount), notes)
            : this.cashService.openSession(this.selectedDrawerId, Number(openingAmount), notes);

        source.subscribe({
            next: session => {
                this.currentSession = session;
                this.currentSummary = this.toSummary(session);
                this.loadHistory();
                this.toast.success('Caja abierta');
                if (this.showInitialCashOpenOnboarding) {
                    this.refreshOnboarding(true);
                }
            },
            error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo abrir la caja')
        });
    }

    withdraw(): void {
        if (!this.currentSession || this.withdrawForm.invalid) {
            this.withdrawForm.markAllAsTouched();
            return;
        }

        const { amount, description } = this.withdrawForm.getRawValue();
        this.cashService.withdraw(this.currentSession.id, Number(amount), description).subscribe({
            next: session => {
                this.currentSession = session;
                this.currentSummary = this.toSummary(session);
                this.loadHistory();
                this.withdrawForm.reset({ amount: 0, description: '' });
                this.showWithdrawModal = false;
                this.toast.success('Extraccion registrada');
            },
            error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo registrar la extraccion')
        });
    }

    deposit(): void {
        if (!this.currentSession || this.depositForm.invalid) {
            this.depositForm.markAllAsTouched();
            return;
        }

        const { amount, description } = this.depositForm.getRawValue();
        this.cashService.deposit(this.currentSession.id, Number(amount), description).subscribe({
            next: session => {
                this.currentSession = session;
                this.currentSummary = this.toSummary(session);
                this.loadHistory();
                this.depositForm.reset({ amount: 0, description: '' });
                this.showDepositModal = false;
                this.toast.success('Ingreso registrado');
            },
            error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo registrar el ingreso')
        });
    }

    get closeDifference(): number {
        const actual = parseFloat(this.closeForm.get('actualClosingAmount')?.value ?? 0);
        const expected = this.currentSummary?.expectedClosingAmount ?? 0;
        return isNaN(actual) ? 0 : actual - expected;
    }

    get currentTransferBankBreakdown(): Array<{ bankName: string; amount: number }> {
        if (this.currentSummary?.transferBankBreakdown?.length) {
            return this.currentSummary.transferBankBreakdown;
        }

        return this.currentSession ? this.computeTransferBankBreakdown(this.currentSession) : [];
    }

    startCloseSessionFlow(): void {
        if (!this.currentSession || this.checkingPendingCloseSales) {
            return;
        }

        this.checkingPendingCloseSales = true;
        this.saleService.listSales({}).subscribe({
            next: sales => {
                const pendingSales = sales.filter(sale =>
                    sale.cashDrawerId === this.selectedDrawerId &&
                    Number(sale.idSaleStatus) === 1
                );

                // Ventas de esta caja despachadas y aún no entregadas (transportStatus 2 = En tránsito):
                // no se puede cerrar hasta confirmar la entrega. El backend lo valida también como red de seguridad.
                const inTransitSales = sales.filter(sale =>
                    sale.cashDrawerId === this.selectedDrawerId &&
                    Number(sale.transportStatus) === 2
                );

                this.checkingPendingCloseSales = false;

                if (inTransitSales.length > 0) {
                    this.toast.error(
                        `No podés cerrar la caja: hay ${inTransitSales.length} venta${inTransitSales.length > 1 ? 's' : ''} en tránsito sin entregar. Confirmá la entrega antes de cerrar.`
                    );
                    return;
                }

                if (pendingSales.length > 0) {
                    this.pendingCloseSales = pendingSales.sort((a, b) => Number(b.pendingAmount ?? 0) - Number(a.pendingAmount ?? 0));
                    this.showPendingCloseSalesModal = true;
                    return;
                }

                this.openCloseConfirmModal();
            },
            error: err => {
                this.checkingPendingCloseSales = false;
                this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron validar las ventas pendientes antes del cierre');
            }
        });
    }

    openCloseConfirmModal(): void {
        this.closeForm.reset({ actualClosingAmount: null, notes: '' });
        this.showCloseConfirmModal = true;
    }

    closeCloseConfirmModal(): void {
        this.showCloseConfirmModal = false;
        this.closeForm.reset({ actualClosingAmount: null, notes: '' });
    }

    closePendingCloseSalesModal(): void {
        this.showPendingCloseSalesModal = false;
        this.pendingCloseSales = [];
    }

    openWithdrawModal(): void {
        this.withdrawForm.reset({ amount: 0, description: '' });
        this.showWithdrawModal = true;
    }

    openDepositModal(): void {
        this.depositForm.reset({ amount: 0, description: '' });
        this.showDepositModal = true;
    }

    closeDepositModal(): void {
        this.showDepositModal = false;
        this.depositForm.reset({ amount: 0, description: '' });
    }

    closeWithdrawModal(): void {
        this.showWithdrawModal = false;
        this.withdrawForm.reset({ amount: 0, description: '' });
    }

    getBlockingSaleAmount(sale: SaleResponse): number {
        const pendingAmount = Number(sale.pendingAmount ?? 0);
        if (pendingAmount > 0) {
            return pendingAmount;
        }

        const settledAmount = Number(sale.settledAmount ?? 0);
        const totalAmount = Number(sale.totalAmount ?? 0);
        const effectivePending = totalAmount - settledAmount;
        return effectivePending > 0 ? effectivePending : totalAmount;
    }

    openTransferModal(): void {
        this.transferForm.reset({ targetCashDrawerId: '', amount: 0, description: '' });
        this.showTransferModal = true;
    }

    closeTransferModal(): void {
        this.showTransferModal = false;
        this.transferForm.reset({ targetCashDrawerId: '', amount: 0, description: '' });
    }

    submitTransfer(): void {
        if (!this.currentSession || this.transferForm.invalid) {
            this.transferForm.markAllAsTouched();
            return;
        }

        if (this.submittingTransfer) return;
        this.submittingTransfer = true;

        const { targetCashDrawerId, amount, description } = this.transferForm.getRawValue();
        this.cashService.transfer(this.selectedDrawerId, targetCashDrawerId, Number(amount), description).subscribe({
            next: () => {
                this.submittingTransfer = false;
                this.showTransferModal = false;
                this.transferForm.reset({ targetCashDrawerId: '', amount: 0, description: '' });
                this.loadCurrentSession();
                this.loadHistory();
                this.toast.success('Transferencia registrada');
            },
            error: err => {
                this.submittingTransfer = false;
                this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo registrar la transferencia');
            }
        });
    }

    get otherDrawers(): CashDrawerResponse[] {
        return this.drawers.filter(drawer => drawer.id !== this.selectedDrawerId);
    }

    get branchOptions(): SearchableSelectOption[] {
        return this.branches.map(branch => ({
            value: branch.id,
            label: branch.name
        }));
    }

    get otherDrawerOptions(): SearchableSelectOption[] {
        return this.otherDrawers.map(drawer => ({
            value: drawer.id,
            label: drawer.name
        }));
    }

    closeSession(): void {
        if (!this.currentSession || this.closeForm.invalid) {
            this.closeForm.markAllAsTouched();
            return;
        }

        const { actualClosingAmount, notes } = this.closeForm.getRawValue();
        const closingAmount = Number(actualClosingAmount);
        this.cashService.closeSession(this.currentSession.id, closingAmount, notes).subscribe({
            next: () => {
                this.showCloseConfirmModal = false;
                this.pendingCloseSales = [];
                this.currentSession = null;
                this.currentSummary = null;
                this.openForm.reset({ openingAmount: closingAmount, notes: '' });
                this.withdrawForm.reset({ amount: 0, description: '' });
                this.depositForm.reset({ amount: 0, description: '' });
                this.closeForm.reset({ actualClosingAmount: null, notes: '' });
                this.loadHistory();
                this.toast.success('Caja cerrada');
            },
            error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo cerrar la caja')
        });
    }

    clearHistoryFilters(): void {
        this.historyFrom = '';
        this.historyTo = '';
        this.loadHistory();
    }

    applyHistoryFilters(): void {
        this.loadHistory();
    }

    toggleSession(sessionId: string): void {
        this.historySessions = this.historySessions.map(item =>
            item.session.id === sessionId
                ? { ...item, expanded: !item.expanded }
                : item
        );
    }

    exportSession(session: CashSessionResponse, expectedOverride?: number): void {
        if (session.movements.length === 0) {
            this.toast.error('La sesion no tiene movimientos para exportar');
            return;
        }

        const headers = [
            'Sesion Id',
            'Estado sesion',
            'Abierta',
            'Cerrada',
            'Movimiento',
            'Tipo',
            'Codigo venta',
            'Sentido',
            'Monto',
            'Medio de pago',
            'Descripcion',
            'Esperado',
            'Cierre real',
            'Diferencia'
        ];

        const body = this.getDisplayRows(session).map(row => [
            session.id,
            session.statusName,
            this.formatDate(session.openedAt),
            this.formatDate(session.closedAt),
            this.formatDate(row.occurredAt),
            row.typeName,
            row.saleCode || '',
            row.directionName,
            row.amount.toFixed(2),
            row.paymentMethodLabel,
            row.description || '',
            (expectedOverride ?? session.expectedClosingAmount).toFixed(2),
            session.actualClosingAmount == null ? '' : session.actualClosingAmount.toFixed(2),
            session.difference.toFixed(2)
        ]);

        const breakdown = this.computePaymentBreakdown(session);
        const transferBreakdown = this.computeTransferBankBreakdown(session);
        const cardBreakdown = this.computeCardBankBreakdown(session);
        const tradeInBreakdown = this.computeTradeInBreakdown(session);
        this.downloadExcel(`cash-session-${session.openedAt.slice(0, 10)}.xlsx`, headers, body, breakdown, transferBreakdown, cardBreakdown, tradeInBreakdown);
    }

    exportFilteredHistory(): void {
        if (this.historySessions.length === 0) {
            this.toast.error('No hay sesiones para exportar');
            return;
        }

        const headers = [
            'Sesion Id',
            'Estado sesion',
            'Abierta',
            'Cerrada',
            'Movimiento',
            'Tipo',
            'Codigo venta',
            'Sentido',
            'Monto',
            'Medio de pago',
            'Descripcion',
            'Esperado',
            'Cierre real',
            'Diferencia'
        ];

        const body = this.historySessions.flatMap(item => this.getDisplayRows(item.session).map(row => [
            item.session.id,
            item.session.statusName,
            this.formatDate(item.session.openedAt),
            this.formatDate(item.session.closedAt),
            this.formatDate(row.occurredAt),
            row.typeName,
            row.saleCode || '',
            row.directionName,
            row.amount.toFixed(2),
            row.paymentMethodLabel,
            row.description || '',
            item.expectedClosingAmount.toFixed(2),
            item.session.actualClosingAmount == null ? '' : item.session.actualClosingAmount.toFixed(2),
            item.session.difference.toFixed(2)
        ]));

        const suffix = this.historyFrom || this.historyTo
            ? `${this.historyFrom || 'inicio'}_${this.historyTo || 'hoy'}`
            : new Date().toLocaleDateString('en-CA');

        const allSessions = this.historySessions.map(item => item.session);
        const allBreakdown = allSessions.flatMap(s => this.computePaymentBreakdown(s));
        const allTransferBreakdown = allSessions.flatMap(s => this.computeTransferBankBreakdown(s));
        const allCardBreakdown = allSessions.flatMap(s => this.computeCardBankBreakdown(s));
        const allTradeInBreakdown = allSessions.flatMap(s => this.computeTradeInBreakdown(s));
        this.downloadExcel(`cash-history-${suffix}.xlsx`, headers, body, allBreakdown, allTransferBreakdown, allCardBreakdown, allTradeInBreakdown);
    }

    exportSessionPdf(session: CashSessionResponse, expectedOverride?: number): void {
        if (session.movements.length === 0) {
            this.toast.error('La sesion no tiene movimientos para exportar');
            return;
        }

        const expected = expectedOverride ?? this.currentSummary?.expectedClosingAmount ?? session.expectedClosingAmount;
        const overrides = new Map<string, number>([[session.id, expected]]);
        this.exportSessionsPdf(`cash-session-${session.openedAt.slice(0, 10)}.pdf`, 'Sesion de caja', [session], overrides);
    }

    exportFilteredHistoryPdf(): void {
        if (this.historySessions.length === 0) {
            this.toast.error('No hay sesiones para exportar');
            return;
        }

        const suffix = this.historyFrom || this.historyTo
            ? `${this.historyFrom || 'inicio'}_${this.historyTo || 'hoy'}`
            : new Date().toLocaleDateString('en-CA');

        const overrides = new Map<string, number>(this.historySessions.map(item => [item.session.id, item.expectedClosingAmount]));
        this.exportSessionsPdf(`cash-history-${suffix}.pdf`, 'Historial de caja', this.historySessions.map(item => item.session), overrides);
    }

    private async exportSessionsPdf(fileName: string, title: string, sessions: CashSessionResponse[], expectedOverrides?: Map<string, number>): Promise<void> {
        const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'landscape' });
        const branding = await this.pdfBranding.prepare();
        const margin = 10;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const maxY = pageHeight - 14;
        const tableWidth = pageWidth - margin * 2;
        let y = 16;

        const movementColumns = this.pdfLayout.resolveColumns(margin, [
            { header: 'Movimiento', width: 31 },
            { header: 'Tipo', width: 21 },
            { header: 'Cod. venta', width: 39 },
            { header: 'Sentido', width: 19 },
            { header: 'Monto', width: 32, align: 'right' },
            { header: 'Pago', width: 66 },
            { header: 'Descripcion', width: tableWidth - 208 }
        ] satisfies PdfTableColumn[]);
        const [movementCol, typeCol, saleCodeCol, directionCol, amountCol, paymentCol, descriptionCol] = movementColumns;

        const drawDocumentHeader = (continuation = false): void => {
            this.pdfBranding.drawWatermark(doc, branding, pageWidth, pageHeight);
            y = this.pdfBranding.drawHeader(doc, branding, {
                title,
                subtitle: 'Caja / Sesiones / Movimientos',
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
            doc.text('Reporte preparado para lectura operativa: resumen superior, movimientos centrales y desglose al cierre de cada sesion.', margin + 3, y + 5.1);
            y += 12;
        };

        const drawMovementHeader = (): void => {
            y = this.pdfLayout.drawTableHeader(doc, movementColumns, y, { tableWidth, fontSize: 7.7 });
        };

        const drawMetricCard = (x: number, width: number, label: string, value: string, tone: 'neutral' | 'accent' | 'success' | 'danger' = 'neutral'): void => {
            if (tone === 'accent') {
                doc.setFillColor(244, 239, 229);
                doc.setDrawColor(221, 206, 180);
            } else if (tone === 'success') {
                doc.setFillColor(233, 245, 237);
                doc.setDrawColor(181, 217, 190);
            } else if (tone === 'danger') {
                doc.setFillColor(248, 235, 235);
                doc.setDrawColor(228, 191, 191);
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
            doc.text(value, x + 2.5, y + 9.7);
        };

        const drawSectionLabel = (label: string): void => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(96, 96, 96);
            doc.text(label.toUpperCase(), margin, y);
            y += 3.2;
        };

        drawDocumentHeader();

        for (let index = 0; index < sessions.length; index += 1) {
            const session = sessions[index];
            const expectedClosingAmount = expectedOverrides?.get(session.id) ?? session.expectedClosingAmount;
            const sessionRows = this.getDisplayRows(session);

            if (y > maxY - 52) {
                doc.addPage();
                y = 16;
                drawDocumentHeader(true);
            }

            drawSectionLabel(`Sesion ${index + 1}`);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.4);
            doc.setTextColor(30, 30, 30);
            const sessionTitleLines = doc.splitTextToSize(`Sesion ${session.id}`, pageWidth - margin * 2 - 40) as string[];
            doc.text(sessionTitleLines, margin, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.2);
            doc.setTextColor(92, 92, 92);
            doc.text(session.statusName, pageWidth - margin, y, { align: 'right' });
            y += Math.max(5.8, sessionTitleLines.length * 4.8 + 1);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.2);
            doc.setTextColor(60, 60, 60);
            const meta = `Apertura: ${this.formatDate(session.openedAt)} | Cierre: ${this.formatDate(session.closedAt) || '-'} | Movimientos: ${sessionRows.length}`;
            const metaLines = doc.splitTextToSize(meta, pageWidth - margin * 2) as string[];
            doc.text(metaLines, margin, y);
            y += metaLines.length * 4 + 2;

            const cardGap = 4;
            const cardWidth = (pageWidth - margin * 2 - cardGap * 3) / 4;
            drawMetricCard(margin, cardWidth, 'Esperado', this.formatCurrency(expectedClosingAmount), 'accent');
            drawMetricCard(margin + cardWidth + cardGap, cardWidth, 'Cierre real', session.actualClosingAmount == null ? '-' : this.formatCurrency(session.actualClosingAmount), 'neutral');
            drawMetricCard(margin + (cardWidth + cardGap) * 2, cardWidth, 'Diferencia', this.formatCurrency(session.difference), session.difference < 0 ? 'danger' : session.difference > 0 ? 'success' : 'neutral');
            drawMetricCard(margin + (cardWidth + cardGap) * 3, cardWidth, 'Estado', session.statusName, 'neutral');
            y += 17;

            drawMovementHeader();

            for (let rowIndex = 0; rowIndex < sessionRows.length; rowIndex += 1) {
                const row = sessionRows[rowIndex];
                const description = row.description || '-';
                const saleCode = row.saleCode || '-';
                const typeLabel = this.translateType(row.typeName);
                const directionLabel = this.translateDirection(row.typeName === 'TransferIncome' ? 'In' : row.directionName);
                const rowValues = [
                    this.formatDate(row.occurredAt),
                    typeLabel,
                    saleCode,
                    directionLabel,
                    this.formatCurrency(row.amount),
                    row.paymentMethodLabel,
                    description
                ];
                const rowOptions = { tableWidth, wrap: true, minHeight: 8.2, lineHeight: 3.4, maxLines: 2, fontSize: 7.9 };
                const rowHeight = this.pdfLayout.measureTableRowHeight(doc, movementColumns, rowValues, rowOptions);

                y = this.pdfLayout.ensurePageSpace(doc, y, rowHeight, pageHeight, () => {
                    y = 16;
                    drawDocumentHeader(true);
                    drawMovementHeader();
                    return y;
                }, 14);

                this.pdfLayout.drawTableRowBackground(doc, margin, y, tableWidth, rowHeight, { alternate: rowIndex % 2 === 0 });
                this.pdfLayout.drawTableSeparator(doc, margin, y + rowHeight, tableWidth);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.9);
                doc.setTextColor(35, 35, 35);
                doc.text(this.pdfLayout.splitCellText(doc, rowValues[0], movementCol, 2), movementCol.x + 1.5, y + 4.8);
                doc.text(this.pdfLayout.splitCellText(doc, rowValues[1], typeCol, 2), typeCol.x + 1.5, y + 4.8);
                doc.text(this.pdfLayout.splitCellText(doc, rowValues[2], saleCodeCol, 2), saleCodeCol.x + 1.5, y + 4.8);
                doc.text(this.pdfLayout.splitCellText(doc, rowValues[3], directionCol, 2), directionCol.x + 1.5, y + 4.8);
                doc.text(rowValues[4], amountCol.x + amountCol.width - 1.5, y + 4.8, { align: 'right' });
                doc.text(this.pdfLayout.splitCellText(doc, rowValues[5], paymentCol, 2), paymentCol.x + 1.5, y + 4.8);
                doc.text(this.pdfLayout.splitCellText(doc, rowValues[6], descriptionCol, 2), descriptionCol.x + 1.5, y + 4.8);

                y += rowHeight;
            }

            const breakdown = this.computePaymentBreakdown(session);
            if (breakdown.length > 0) {
                if (y + 10 + breakdown.length * 5 > maxY) {
                    doc.addPage();
                    y = 16;
                    drawDocumentHeader(true);
                }

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(60, 60, 60);
                doc.text('Desglose por medio de pago', margin, y + 4);
                y += 6.5;

                for (const item of breakdown) {
                    if (y + 5 > maxY) {
                        doc.addPage();
                        y = 16;
                        drawDocumentHeader(true);
                    }

                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7.6);
                    doc.setTextColor(35, 35, 35);
                    doc.setFillColor(246, 246, 244);
                    doc.roundedRect(margin + 1, y, 80, 4.8, 1.2, 1.2, 'F');
                    doc.text(item.methodName, margin + 4, y + 3.5);
                    doc.text(this.formatCurrency(item.amount), margin + 77, y + 3.5, { align: 'right' });
                    y += 5;
                }
            }

            const transferBreakdown = this.computeTransferBankBreakdown(session);
            if (transferBreakdown.length > 0) {
                if (y + 10 + transferBreakdown.length * 5 > maxY) {
                    doc.addPage();
                    y = 16;
                    drawDocumentHeader(true);
                }

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(60, 60, 60);
                doc.text('Transferencias por banco (no incluido en caja)', margin, y + 4);
                y += 6.5;

                for (const item of transferBreakdown) {
                    if (y + 5 > maxY) {
                        doc.addPage();
                        y = 16;
                        drawDocumentHeader(true);
                    }

                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7.6);
                    doc.setTextColor(35, 35, 35);
                    doc.setFillColor(241, 247, 249);
                    doc.roundedRect(margin + 1, y, 80, 4.8, 1.2, 1.2, 'F');
                    doc.text(item.bankName, margin + 4, y + 3.5);
                    doc.text(this.formatCurrency(item.amount), margin + 77, y + 3.5, { align: 'right' });
                    y += 5;
                }
            }

            const cardBreakdown = this.computeCardBankBreakdown(session);
            if (cardBreakdown.length > 0) {
                if (y + 10 + cardBreakdown.length * 5 > maxY) {
                    doc.addPage();
                    y = 16;
                    drawDocumentHeader(true);
                }

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(60, 60, 60);
                doc.text('Tarjetas por banco (no incluido en caja)', margin, y + 4);
                y += 6.5;

                for (const item of cardBreakdown) {
                    if (y + 5 > maxY) {
                        doc.addPage();
                        y = 16;
                        drawDocumentHeader(true);
                    }

                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7.6);
                    doc.setTextColor(35, 35, 35);
                    doc.setFillColor(243, 243, 249);
                    doc.roundedRect(margin + 1, y, 80, 4.8, 1.2, 1.2, 'F');
                    doc.text(item.bankName, margin + 4, y + 3.5);
                    doc.text(this.formatCurrency(item.amount), margin + 77, y + 3.5, { align: 'right' });
                    y += 5;
                }
            }

            const tradeInBreakdown = this.computeTradeInBreakdown(session);
            if (tradeInBreakdown.length > 0) {
                if (y + 10 + tradeInBreakdown.length * 5 > maxY) {
                    doc.addPage();
                    y = 16;
                    drawDocumentHeader(true);
                }

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(60, 60, 60);
                doc.text('Canjes (no incluido en caja)', margin, y + 4);
                y += 6.5;

                for (const item of tradeInBreakdown) {
                    if (y + 5 > maxY) {
                        doc.addPage();
                        y = 16;
                        drawDocumentHeader(true);
                    }

                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7.6);
                    doc.setTextColor(35, 35, 35);
                    doc.setFillColor(232, 245, 237);
                    doc.roundedRect(margin + 1, y, 80, 4.8, 1.2, 1.2, 'F');
                    doc.text(item.productName, margin + 4, y + 3.5);
                    doc.text(this.formatCurrency(item.amount), margin + 77, y + 3.5, { align: 'right' });
                    y += 5;
                }
            }

            y += 7;
        }

        const pageCount = doc.getNumberOfPages();
        for (let page = 1; page <= pageCount; page += 1) {
            doc.setPage(page);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(125, 125, 125);
            doc.text(`Pagina ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
        }

        doc.save(fileName);
    }

    private loadBranches(): void {
        this.branchService.listBranches().subscribe({
            next: branches => {
                this.branches = branches;

                if (!this.selectedBranchId && this.isRestrictedToAssignedDrawer && branches.length > 0) {
                    const assignedDrawerId = this.auth.currentUser?.assignedCashDrawerId;
                    forkJoin(branches.map(branch => this.cashService.listCashDrawers(branch.id))).subscribe({
                        next: drawerSets => {
                            const foundIndex = drawerSets.findIndex(drawers => drawers.some(drawer => drawer.id === assignedDrawerId));
                            if (foundIndex >= 0) {
                                this.selectBranch(branches[foundIndex].id);
                            }
                        },
                        error: () => undefined
                    });
                    return;
                }

                if (!this.selectedBranchId && branches.length > 0) {
                    this.selectBranch(branches[0].id);
                }
            },
            error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudieron cargar las sucursales')
        });
    }

    private loadCurrentSession(): void {
        if (!this.selectedDrawerId) {
            return;
        }

        this.loadingSession = true;
        this.currentSession = null;
        this.currentSummary = null;
        // El sugerido es por caja: al cambiar de caja hay que descartar el anterior.
        this.suggestedOpeningAmount = null;
        this.openForm.patchValue({ openingAmount: 0 });
        this.salePaymentMethodsBySaleId.clear();
        this.salesBySaleId.clear();
        this.ccSalesBySaleId.clear();

        this.cashService.getCurrentSession(this.selectedDrawerId).subscribe({
            next: session => {
                this.currentSession = session;
                this.currentSummary = this.toSummary(session);
                this.loadSalePaymentMethods([session]);
                this.cashService.getSummary(session.id).subscribe({
                    next: summary => {
                        this.currentSummary = summary;
                    }
                });
                this.loadingSession = false;
            },
            error: () => {
                this.loadingSession = false;
                if (this.selectedDrawerId) {
                    this.loadingSuggestedOpening = true;
                    this.cashService.getLastClosedSession(this.selectedDrawerId).subscribe({
                        next: ({ suggestedOpeningAmount }) => {
                            this.loadingSuggestedOpening = false;
                            this.suggestedOpeningAmount = suggestedOpeningAmount;
                            if (suggestedOpeningAmount > 0) {
                                this.openForm.patchValue({ openingAmount: suggestedOpeningAmount });
                            }
                        },
                        // Sin esto la falla es muda y el formulario queda en 0 sin que nadie se entere.
                        error: () => {
                            this.loadingSuggestedOpening = false;
                            this.suggestedOpeningAmount = null;
                            this.toast.error('No se pudo obtener el cierre anterior. Verifica el monto inicial antes de abrir.');
                        }
                    });
                }
            }
        });
    }

    private loadHistory(): void {
        if (!this.selectedDrawerId) {
            this.historySessions = [];
            return;
        }

        this.loadingHistory = true;
        this.historySessions = [];
        this.salePaymentMethodsBySaleId.clear();
        this.salesBySaleId.clear();
        this.ccSalesBySaleId.clear();

        this.cashService.listHistory(this.selectedDrawerId, this.historyFrom || undefined, this.historyTo || undefined).subscribe({
            next: sessions => {
                this.historySessions = sessions.map(session => {
                    const salesIncome = this.netSalesMovements(session.movements);
                    const withdrawals = this.sumMovementsByType(session.movements, 'CashWithdrawal');
                    const manualDeposits = this.sumMovementsByType(session.movements, 'CashDeposit');
                    return {
                        session,
                        expanded: false,
                        salesIncome,
                        manualDeposits,
                        withdrawals,
                        expectedClosingAmount: session.expectedClosingAmount
                    };
                });
                this.loadSalePaymentMethods(sessions);
                this.loadingHistory = false;
            },
            error: err => {
                this.loadingHistory = false;
                this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo cargar el historial de caja');
            }
        });
    }

    private toSummary(session: CashSessionResponse): CashSessionSummaryResponse {
        const salesIncome = this.netSalesMovements(session.movements);

        const withdrawals = session.movements
            .filter(movement => movement.typeName === 'CashWithdrawal')
            .reduce((total, movement) => total + movement.amount, 0);

        const manualDeposits = session.movements
            .filter(movement => movement.typeName === 'CashDeposit')
            .reduce((total, movement) => total + movement.amount, 0);

        const salesCancellations = session.movements
            .filter(movement => movement.typeName === 'SaleCancellation' || movement.typeName === 'CuentaCorrienteCancellation')
            .reduce((total, movement) => total + movement.amount, 0);

        return {
            id: session.id,
            openingAmount: session.openingAmount,
            salesIncome,
            manualDeposits,
            withdrawals,
            salesCancellations,
            expectedClosingAmount: session.expectedClosingAmount,
            actualClosingAmount: session.actualClosingAmount,
            difference: session.difference
        };
    }

    private sumMovementsByType(movements: CashSessionMovementResponse[], typeName: string): number {
        return movements
            .filter(movement => movement.typeName === typeName)
            .reduce((total, movement) => total + movement.amount, 0);
    }

    private netSalesMovements(movements: CashSessionMovementResponse[]): number {
        return movements
            .filter(movement =>
                movement.referenceType === 'Sale'
                && (movement.typeName === 'SaleIncome'
                    || movement.typeName === 'TransferIncome'
                    || movement.typeName === 'CardIncome'
                    || movement.typeName === 'SaleCancellation'))
            .reduce((total, movement) =>
                total + (movement.typeName === 'SaleCancellation'
                    ? -movement.amount
                    : movement.amount), 0);
    }

    translateDescription(description: string | null | undefined): string {
        if (!description) return '-';
        const map: Record<string, string> = {
            'Opening balance': 'Balance de apertura',
            'Closing balance': 'Balance de cierre',
            'Sale income': 'Ingreso por venta',
            'Sale payment': 'Pago de venta',
            'Cash withdrawal': 'Extracción de efectivo',
            'Cash deposit': 'Depósito de efectivo',
            'Manual adjustment': 'Ajuste manual',
            'Initial opening': 'Apertura inicial',
            'Sale cancellation': 'Cancelación de venta',
            'CC payment': 'Pago cuenta corriente',
            'CC payment cancelled': 'Pago CC anulado',
            'Pago cuenta corriente': 'Pago cuenta corriente',
            'Pago CC anulado': 'Pago CC anulado',
        };
        return map[description] ?? description;
    }

    translateType(typeName: string): string {
        const map: Record<string, string> = {
            SaleIncome: 'Venta',
            CashWithdrawal: 'Extracción',
            CashDeposit: 'Ingreso manual',
            OpeningBalance: 'Apertura',
            ClosingBalance: 'Cierre',
            CashTransferOut: 'Transferencia saliente',
            CashTransferIn: 'Transferencia entrante',
            OpeningFloat: 'Apertura',
            SaleCancellation: 'Cancelación de venta',
            CuentaCorrienteIncome: 'Cuenta Corriente',
            CuentaCorrienteCancellation: 'Anulación CC',
            TransferIncome: 'Venta',
            CardIncome: 'Venta',
            PurchaseExpense: 'Proveedores',
            PurchasePaymentCancellation: 'Anulación pago compra',
            PayrollExpense: 'Pago de sueldo',
            PayrollExpenseCancellation: 'Anulación pago sueldo',
            PayrollAdvanceExpense: 'Adelanto de sueldo',
            PayrollAdvanceExpenseCancellation: 'Anulación adelanto sueldo',
            CustomerCreditNote: 'NC a cliente',
            CustomerCreditNoteCancellation: 'NC a cliente anulada',
            SupplierCreditNote: 'NC de proveedor',
            SupplierCreditNoteCancellation: 'NC de proveedor anulada',
        };
        return map[typeName] ?? typeName;
    }

    /** Color de la pastilla del movimiento (paleta de movimientos de EITI 2). */
    movTone(row: { typeName: string }): string {
        const map: Record<string, string> = {
            SaleIncome: 'sale', TransferIncome: 'sale', CardIncome: 'sale',
            CashDeposit: 'in', OpeningBalance: 'in', OpeningFloat: 'in',
            CashWithdrawal: 'out', SaleCancellation: 'out',
            ClosingBalance: 'neutral',
            CashTransferOut: 'transfer-out', CashTransferIn: 'transfer-in',
            CuentaCorrienteIncome: 'cc', CuentaCorrienteCancellation: 'cc-void',
            PurchaseExpense: 'supplier', PurchasePaymentCancellation: 'supplier',
            SupplierCreditNote: 'supplier-nc', SupplierCreditNoteCancellation: 'supplier-nc',
            PayrollExpense: 'payroll', PayrollExpenseCancellation: 'payroll',
            PayrollAdvanceExpense: 'payroll', PayrollAdvanceExpenseCancellation: 'payroll',
            CustomerCreditNote: 'customer-nc', CustomerCreditNoteCancellation: 'customer-nc'
        };
        return map[row.typeName] ?? 'neutral';
    }

    translateDirection(directionName: string): string {
        const map: Record<string, string> = {
            In: 'Entrada',
            Out: 'Salida',
            None: '-',
        };
        return map[directionName] ?? directionName;
    }

    movementPaymentMethod(movement: CashSessionMovementResponse): string {
        if (movement.paymentMethod) {
            if (movement.typeName === 'PurchaseExpense' || movement.typeName === 'PurchasePaymentCancellation') {
                return this.purchasePaymentMethodLabel(movement.paymentMethod);
            }
            return SALE_PAYMENT_METHODS.find(method => method.id === Number(movement.paymentMethod))?.label ?? 'Otros';
        }

        if (movement.typeName === 'PurchaseExpense') {
            const knownMethods = ['Efectivo', 'Transferencia', 'Cheque', 'Otro'];
            return knownMethods.includes(movement.description ?? '') ? (movement.description ?? '-') : '-';
        }

        const refType = movement.referenceType;
        const isRegularSale = refType?.toLowerCase() === 'sale';
        const isCcSale = refType === 'CuentaCorriente';
        if ((!isRegularSale && !isCcSale) || !movement.referenceId) {
            return '-';
        }

        return this.salePaymentMethodsBySaleId.get(movement.referenceId) || 'Cargando...';
    }

    getDisplayRows(session: CashSessionResponse): CashDisplayRow[] {
        const seenSaleIncomeIds = new Set<string>();
        const rows: CashDisplayRow[] = [];

        for (const movement of session.movements) {
            const refId = movement.referenceId ? String(movement.referenceId) : null;
            const saleCode = movement.saleCode ?? null;
            const username = movement.createdByUsername ?? null;

            // Pago de cuenta corriente que llegó por transferencia/tarjeta: reutiliza los tipos
            // TransferIncome/CardIncome pero pertenece a una cuenta corriente (referenceType =
            // CuentaCorriente). Se renderiza como fila de CC (clickable -> popup CC, etiqueta
            // "Cuenta Corriente") en vez de mezclarlo con la logica de venta directa, cuyo
            // salesBySaleId nunca contiene ventas CC (listSales las excluye).
            if ((movement.referenceType === 'CuentaCorriente' || movement.referenceType === 'CustomerPayment')
                && (movement.typeName === 'CuentaCorrienteIncome' || movement.typeName === 'TransferIncome' || movement.typeName === 'CardIncome')) {
                const bankSuffix = movement.transferBankId
                    ? ` - ${this.bankNamesById.get(movement.transferBankId) ?? 'Banco #' + movement.transferBankId}`
                    : '';
                rows.push({ occurredAt: movement.occurredAt, typeName: 'CuentaCorrienteIncome', directionName: movement.directionName, amount: movement.amount, paymentMethodLabel: this.movementPaymentMethod(movement) + bankSuffix, description: movement.description, referenceType: movement.referenceType ?? null, referenceId: refId, saleCode, username, originalCashSessionId: movement.originalCashSessionId ?? null, customerPaymentId: movement.customerPaymentId ?? null });
                continue;
            }

            const isSaleIncome = (movement.typeName === 'SaleIncome' || movement.typeName === 'TransferIncome' || movement.typeName === 'CardIncome') && movement.referenceId;

            if (isSaleIncome) {
                const saleRefId = String(movement.referenceId);
                if (seenSaleIncomeIds.has(saleRefId)) continue;
                seenSaleIncomeIds.add(saleRefId);

                const sale = this.salesBySaleId.get(saleRefId);
                const activePayments = (sale?.payments ?? []).filter(p => Number(p.amount) > 0);
                const allTradeIns = sale?.tradeIns ?? [];
                const activeTradeIns = allTradeIns.filter(t => Number(t.amount) > 0);
                if (activePayments.length > 0 || allTradeIns.length > 0) {
                    const totalAmount = activePayments.reduce((sum, p) => sum + Number(p.amount), 0)
                        + activeTradeIns.reduce((sum, t) => sum + Number(t.amount), 0);
                    const parts: string[] = [
                        ...activePayments.map(p => {
                            const methodLabel = p.paymentMethodName?.trim() || SALE_PAYMENT_METHODS.find(m => m.id === Number(p.idPaymentMethod))?.label || 'Otros';
                            const transferRef = (p as any).reference as string | null | undefined;
                            let bankSuffix = '';
                            if (Number(p.idPaymentMethod) === 2) {
                                bankSuffix = p.transferBankId
                                    ? ` - ${this.bankNamesById.get(p.transferBankId) ?? 'Banco #' + p.transferBankId}`
                                    : (transferRef ? ` (${transferRef})` : '');
                            } else if (Number(p.idPaymentMethod) === 3 && p.cardBankId) {
                                bankSuffix = ` - ${this.bankNamesById.get(p.cardBankId) ?? 'Banco #' + p.cardBankId}`;
                            }
                            return `${methodLabel}${bankSuffix}: $${Number(p.amount).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
                        }),
                        ...allTradeIns.map(t => Number(t.amount) > 0
                            ? `Canje: $${Number(t.amount).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
                            : 'Canje')
                    ];
                    rows.push({ occurredAt: movement.occurredAt, typeName: 'SaleIncome', directionName: 'In', amount: totalAmount, paymentMethodLabel: parts.join(' | '), description: movement.description, referenceType: movement.referenceType ?? null, referenceId: refId, saleCode, username });
                    continue;
                }
                rows.push({ occurredAt: movement.occurredAt, typeName: 'SaleIncome', directionName: 'In', amount: movement.amount, paymentMethodLabel: this.movementPaymentMethod(movement), description: movement.description, referenceType: movement.referenceType ?? null, referenceId: refId, saleCode, username });
                continue;
            }

            const effectiveDirection = movement.typeName === 'PurchaseExpense' ? 'Out' : movement.directionName;
            const effectiveDescription = movement.typeName === 'PurchaseExpense' ? 'Compra proveedor' : movement.description;
            rows.push({ occurredAt: movement.occurredAt, typeName: movement.typeName, directionName: effectiveDirection, amount: movement.amount, paymentMethodLabel: this.movementPaymentMethod(movement), description: effectiveDescription, referenceType: movement.referenceType ?? null, referenceId: movement.referenceType === 'SupplierPayment' ? null : refId, saleCode, username, originalCashSessionId: movement.originalCashSessionId ?? null, customerPaymentId: movement.customerPaymentId ?? null });
        }

        return rows;
    }

    sessionPaymentMethodsSummary(session: CashSessionResponse): string {
        const methods = [...new Set(
            session.movements
                .map(movement => this.movementPaymentMethod(movement))
                .filter(method => method !== '-' && method !== 'Cargando...')
        )];

        return methods.length > 0 ? methods.join(' | ') : 'Sin ventas con medio identificado';
    }

    private downloadExcel(
        fileName: string,
        headers: string[],
        body: string[][],
        breakdown?: PaymentMethodBreakdownItem[],
        transferBreakdown?: Array<{ bankName: string; amount: number }>,
        cardBreakdown?: Array<{ bankName: string; amount: number }>,
        tradeInBreakdown?: Array<{ productName: string; amount: number }>
    ): void {
        const rows = body.map(columns =>
            headers.reduce<Record<string, string>>((result, header, index) => {
                result[header] = columns[index] ?? '';
                return result;
            }, {})
        );

        const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Caja');

        if (breakdown && breakdown.length > 0) {
            const breakdownHeaders = ['Medio de pago', 'Monto'];
            const breakdownRows: Array<Record<string, string>> = breakdown.map(item => ({
                'Medio de pago': item.methodName,
                'Monto': item.amount.toFixed(2)
            }));

            if (transferBreakdown && transferBreakdown.length > 0) {
                breakdownRows.push({ 'Medio de pago': '', 'Monto': '' });
                breakdownRows.push({ 'Medio de pago': 'Transferencias por banco (no incluido en caja)', 'Monto': '' });
                for (const t of transferBreakdown) {
                    breakdownRows.push({ 'Medio de pago': t.bankName, 'Monto': t.amount.toFixed(2) });
                }
            }

            if (cardBreakdown && cardBreakdown.length > 0) {
                breakdownRows.push({ 'Medio de pago': '', 'Monto': '' });
                breakdownRows.push({ 'Medio de pago': 'Tarjetas por banco (no incluido en caja)', 'Monto': '' });
                for (const c of cardBreakdown) {
                    breakdownRows.push({ 'Medio de pago': c.bankName, 'Monto': c.amount.toFixed(2) });
                }
            }

            if (tradeInBreakdown && tradeInBreakdown.length > 0) {
                breakdownRows.push({ 'Medio de pago': '', 'Monto': '' });
                breakdownRows.push({ 'Medio de pago': 'Canjes (no incluido en caja)', 'Monto': '' });
                for (const t of tradeInBreakdown) {
                    breakdownRows.push({ 'Medio de pago': t.productName, 'Monto': t.amount.toFixed(2) });
                }
            }

            const breakdownSheet = XLSX.utils.json_to_sheet(breakdownRows, { header: breakdownHeaders });
            XLSX.utils.book_append_sheet(workbook, breakdownSheet, 'Medios de Pago');
        }

        XLSX.writeFile(workbook, fileName, { compression: true });
    }

    private formatCurrency(value: number): string {
        return formatMoney(value, true);
    }

    private formatDate(value?: string | null): string {
        if (!value) {
            return '';
        }

        return new Date(value).toLocaleString();
    }

    private loadSalePaymentMethods(sessions: CashSessionResponse[]): void {
        const allMovements = sessions.flatMap(session => session.movements);

        const saleIds = [...new Set(
            allMovements
                .filter(movement => (movement.referenceType?.toLowerCase() === 'sale' || movement.typeName === 'SaleCancellation') && !!movement.referenceId)
                .map(movement => String(movement.referenceId))
        )];

        const ccSaleIds = [...new Set(
            allMovements
                .filter(movement => movement.referenceType === 'CuentaCorriente' && !!movement.referenceId)
                .map(movement => String(movement.referenceId))
        )];

        if (saleIds.length > 0) {
            this.saleService.listSales({}).subscribe({
                next: sales => {
                    const salesById = new Map<string, SaleResponse>(
                        sales
                            .filter(sale => saleIds.includes(sale.id))
                            .map(sale => [sale.id, sale])
                    );

                    for (const saleId of saleIds) {
                        const sale = salesById.get(saleId);
                        if (!sale) {
                            continue;
                        }

                        this.salePaymentMethodsBySaleId.set(saleId, paymentMethodSummary(sale.payments, sale.tradeIns));
                        this.salesBySaleId.set(saleId, sale);
                    }
                }
            });
        }

        for (const saleId of ccSaleIds) {
            this.saleService.getSaleById(saleId).subscribe({
                next: (sale: SaleByIdResponse) => {
                    this.ccSalesBySaleId.set(saleId, sale);
                    const allCcPayments = (sale.ccPayments ?? []);
                    const activeCcPayments = allCcPayments.filter(p => p.status === 1);
                    const ccPaymentsForLabel = activeCcPayments.length > 0 ? activeCcPayments : allCcPayments.filter(p => p.status === 2);
                    if (ccPaymentsForLabel.length === 0) {
                        return;
                    }
                    const methodMap = new Map<number, number>();
                    for (const p of ccPaymentsForLabel) {
                        methodMap.set(p.idPaymentMethod, (methodMap.get(p.idPaymentMethod) ?? 0) + p.amount);
                    }
                    const parts = Array.from(methodMap.entries()).map(([id, amount]) => {
                        const name = SALE_PAYMENT_METHODS.find(m => m.id === id)?.label ?? 'Otro';
                        return `${name}: $${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
                    });
                    this.salePaymentMethodsBySaleId.set(saleId, parts.join(' | '));
                }
            });
        }
    }

    computePaymentBreakdown(session: CashSessionResponse): PaymentMethodBreakdownItem[] {
        return [...(session.paymentBreakdown ?? [])]
            .filter(item => Number(item.amount) !== 0 || Number(item.surchargeAmount ?? 0) !== 0)
            .sort((a, b) => Number(a.method) - Number(b.method));
    }

    computeTransferBankBreakdown(session: CashSessionResponse): Array<{ bankName: string; amount: number }> {
        const totals = new Map<number, number>();
        const seen = new Set<string>();
        for (const movement of session.movements) {
            if ((movement.typeName === 'SaleIncome' || movement.typeName === 'TransferIncome' || movement.typeName === 'SaleCancellation') && movement.referenceId && !seen.has(movement.referenceId)) {
                seen.add(movement.referenceId);
                const sale = this.salesBySaleId.get(String(movement.referenceId));
                for (const p of (sale?.payments ?? [])) {
                    if (Number(p.idPaymentMethod) === 2 && p.transferBankId && Number(p.amount) > 0) {
                        totals.set(p.transferBankId, (totals.get(p.transferBankId) ?? 0) + Number(p.amount));
                    }
                }
            }
            // Cobros de cuenta corriente por transferencia: el banco viene en el movimiento. El ingreso suma
            // y la anulación resta, igual que el resumen que arma el servidor para la caja abierta.
            if (movement.customerPaymentId && movement.transferBankId
                && (movement.typeName === 'TransferIncome' || movement.typeName === 'CuentaCorrienteCancellation')) {
                const signed = movement.typeName === 'CuentaCorrienteCancellation' ? -Number(movement.amount) : Number(movement.amount);
                totals.set(movement.transferBankId, (totals.get(movement.transferBankId) ?? 0) + signed);
            }
        }
        return Array.from(totals.entries())
            .filter(([, amount]) => amount !== 0)
            .map(([bankId, amount]) => ({ bankName: this.bankNamesById.get(bankId) ?? 'Banco #' + bankId, amount }))
            .sort((a, b) => a.bankName.localeCompare(b.bankName));
    }

    computeCardBankBreakdown(session: CashSessionResponse): Array<{ bankName: string; amount: number }> {
        const totals = new Map<number, number>();
        const seen = new Set<string>();
        for (const movement of session.movements) {
            if ((movement.typeName === 'SaleIncome' || movement.typeName === 'CardIncome' || movement.typeName === 'SaleCancellation') && movement.referenceId && !seen.has(movement.referenceId)) {
                seen.add(movement.referenceId);
                const sale = this.salesBySaleId.get(String(movement.referenceId));
                for (const p of (sale?.payments ?? [])) {
                    if (Number(p.idPaymentMethod) === 3 && p.cardBankId && Number(p.amount) > 0) {
                        totals.set(p.cardBankId, (totals.get(p.cardBankId) ?? 0) + Number(p.amount));
                    }
                }
            }
        }
        return Array.from(totals.entries())
            .map(([bankId, amount]) => ({ bankName: this.bankNamesById.get(bankId) ?? 'Banco #' + bankId, amount }))
            .sort((a, b) => a.bankName.localeCompare(b.bankName));
    }

    computeTradeInBreakdown(session: CashSessionResponse): Array<{ productName: string; amount: number }> {
        const totals = new Map<string, number>();
        const seen = new Set<string>();
        for (const movement of session.movements) {
            if ((movement.typeName === 'SaleIncome' || movement.typeName === 'SaleCancellation') && movement.referenceId && !seen.has(movement.referenceId)) {
                seen.add(movement.referenceId);
                const sale = this.salesBySaleId.get(String(movement.referenceId));
                for (const t of (sale?.tradeIns ?? [])) {
                    if (Number(t.amount) > 0) {
                        const name = t.productName?.trim() || 'Canje';
                        totals.set(name, (totals.get(name) ?? 0) + Number(t.amount));
                    }
                }
            }
        }
        return Array.from(totals.entries())
            .map(([productName, amount]) => ({ productName, amount }))
            .sort((a, b) => a.productName.localeCompare(b.productName));
    }

    get currentCardBankBreakdown(): Array<{ bankName: string; amount: number }> {
        return this.currentSession ? this.computeCardBankBreakdown(this.currentSession) : [];
    }

    computeTotalCardSurcharge(session: CashSessionResponse): number {
        let total = 0;
        const seen = new Set<string>();
        for (const movement of session.movements) {
            // Only count SaleIncome movements to avoid double-counting cancelled sales
            if (movement.typeName === 'SaleIncome' && movement.referenceId && !seen.has(movement.referenceId)) {
                seen.add(movement.referenceId);
                const sale = this.salesBySaleId.get(String(movement.referenceId));
                if (!sale) continue;
                for (const payment of (sale.payments ?? [])) {
                    if (Number(payment.idPaymentMethod) === 3) {
                        total += Number(payment.cardSurchargeAmt ?? 0);
                    }
                }
            }
        }
        return total;
    }

    isClosedSession(statusName?: string | null): boolean {
        return (statusName || '').toLowerCase() === 'closed';
    }

    get selectedBranchName(): string {
        return this.branches.find(b => b.id === this.selectedBranchId)?.name ?? '';
    }

    get selectedDrawerName(): string {
        return this.drawers.find(d => d.id === this.selectedDrawerId)?.name ?? '';
    }

    /** Monto neto por medio de pago de la sesión abierta, con su ancho relativo para las barras. */
    get currentPaymentBars(): Array<{ name: string; amount: number; pct: number }> {
        const rows = (this.currentSession?.paymentBreakdown ?? []).map(bd => ({
            name: bd.methodName,
            amount: bd.amount + (bd.surchargeAmount ?? 0)
        }));
        const max = Math.max(0, ...rows.map(r => Math.abs(r.amount)));
        return rows.map(r => ({ ...r, pct: max > 0 ? Math.round(Math.abs(r.amount) / max * 100) : 0 }));
    }

    get isCurrentSessionStale(): boolean {
        if (!this.currentSession) return false;
        const hoursOpen = (Date.now() - new Date(this.currentSession.openedAt).getTime()) / (1000 * 60 * 60);
        return hoursOpen >= 20;
    }

    handleCashDrawerBannerAction(): void {
        if (this.cashDrawerFocusLocked) {
            this.onboardingService.acceptStep('CashDrawer');
            return;
        }

        this.toggleCreateDrawer();
    }

    acceptInitialCashOpenStep(): void {
        this.onboardingService.acceptStep('InitialCashOpen');
    }

    isLinkedMovement(row: CashDisplayRow): boolean {
        return (row.typeName === 'CuentaCorrienteIncome' && !!row.referenceId)
            || (row.typeName === 'SaleCancellation' && !!row.referenceId)
            || (row.typeName === 'PurchaseExpense' && !!row.referenceId);
    }

    openLinkedMovement(row: CashDisplayRow): void {
        if (!this.isLinkedMovement(row)) {
            return;
        }

        if (row.typeName === 'CuentaCorrienteIncome' && row.referenceId) {
            if (row.referenceType === 'CustomerPayment') {
                this.openCustomerPaymentLink(row.customerPaymentId ?? row.referenceId);
                return;
            }

            this.openCcPopup(row.referenceId);
            return;
        }

        if (row.typeName === 'SaleCancellation' && row.referenceId) {
            this.openCancelDetailPopup(row);
            return;
        }

        if (row.typeName === 'PurchaseExpense' && row.referenceId) {
            this.openPurchasePopup(row.referenceId);
        }
    }

    openCustomerPaymentLink(paymentId: string): void {
        this.customerPaymentPopupId = paymentId;
        this.customerPaymentPopupLink = null;
        this.customerPaymentPopupAccount = null;
        this.customerPaymentPopupMovement = null;
        this.customerPaymentPopupLoading = true;

        this.customerAccountService.getPaymentLink(paymentId).subscribe({
            next: link => {
                this.customerPaymentPopupLink = link;
                this.customerAccountService.getAccount(link.customerId).subscribe({
                    next: account => {
                        this.customerPaymentPopupAccount = account;
                        this.customerPaymentPopupMovement = account.movements.find(m => m.type === 'cobro' && m.id === paymentId) ?? null;
                        this.customerPaymentPopupLoading = false;
                    },
                    error: () => {
                        this.customerPaymentPopupLoading = false;
                        this.toast.error('No se pudo cargar el detalle del cliente');
                    }
                });
            },
            error: () => {
                this.closeCustomerPaymentPopup();
                this.toast.error('No se pudo abrir el cobro vinculado');
            }
        });
    }

    closeCustomerPaymentPopup(): void {
        this.customerPaymentPopupId = null;
        this.customerPaymentPopupLink = null;
        this.customerPaymentPopupAccount = null;
        this.customerPaymentPopupMovement = null;
        this.customerPaymentPopupLoading = false;
    }

    get customerPaymentPopupImputaciones(): CustomerPaymentImputacion[] {
        return this.customerPaymentPopupMovement?.imputaciones ?? [];
    }

    get customerPaymentPopupImputed(): number {
        return this.customerPaymentPopupImputaciones.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    }

    get customerPaymentPopupCredit(): number {
        if (this.customerPaymentPopupMovement?.sobrante != null) {
            return Math.max(0, Number(this.customerPaymentPopupMovement.sobrante));
        }

        return Math.max(0, Number(this.customerPaymentPopupLink?.amount ?? 0) - this.customerPaymentPopupImputed);
    }

    openCcPopup(saleId: string): void {
        this.ccPopupSaleId = saleId;
        this.ccPopupPayments = [];
        this.ccPopupLoading = true;
        this.saleService.listCcPayments(saleId).subscribe({
            next: payments => { this.ccPopupPayments = payments; this.ccPopupLoading = false; },
            error: () => { this.ccPopupLoading = false; this.toast.error('No se pudo cargar el historial de pagos'); }
        });
    }

    closeCcPopup(): void { this.ccPopupSaleId = null; this.ccPopupPayments = []; }

    openCancelDetailPopup(row: CashDisplayRow): void {
        this.cancelDetailPopupRow = row;
    }

    closeCancelDetailPopup(): void {
        this.cancelDetailPopupRow = null;
    }

    get cancelDetailSale(): SaleResponse | undefined {
        return this.cancelDetailPopupRow?.referenceId
            ? this.salesBySaleId.get(this.cancelDetailPopupRow.referenceId)
            : undefined;
    }

    get ccPopupSale(): SaleByIdResponse | null {
        return this.ccPopupSaleId ? (this.ccSalesBySaleId.get(this.ccPopupSaleId) ?? null) : null;
    }

    paymentMethodLabel(idPaymentMethod: number): string {
        return SALE_PAYMENT_METHODS.find(m => m.id === idPaymentMethod)?.label ?? 'Otro';
    }

    // Descarga TODOS los recibos de pagos activos de esta venta en un solo PDF (una pagina por pago).
    downloadAllCcReceipts(): void {
        const sale = this.ccPopupSale;
        if (!sale) { return; }
        const activePayments = this.ccPopupPayments.filter(p => p.status === 1);
        if (activePayments.length === 0) {
            this.toast.error('No hay pagos activos para generar recibos');
            return;
        }
        const receipts: PaymentReceiptData[] = activePayments.map(p => ({
            kind: 'cobro',
            partyLabel: 'Cliente',
            partyName: sale.customerFullName || 'Sin cliente',
            amount: p.amount,
            date: p.date,
            methodLabel: this.paymentMethodLabel(p.idPaymentMethod),
            notes: p.notes,
            coverage: [{ code: sale.code || 'S/N', amount: p.amount }],
            saleDetailSections: [{
                code: sale.code || 'S/N',
                details: sale.details.map(detail => ({
                    productBrand: detail.productBrand,
                    productName: detail.productName,
                    quantity: detail.quantity,
                    unitPrice: detail.unitPrice,
                    totalAmount: detail.totalAmount
                }))
            }]
        }));
        this.paymentReceiptPdf.generateBatch(receipts, `recibos-${sale.code || sale.id}.pdf`)
            .catch(() => this.toast.error('No se pudieron generar los recibos'));
    }

    downloadCustomerPaymentReceipt(): void {
        const payment = this.customerPaymentPopupLink;
        if (!payment) { return; }
        const data: PaymentReceiptData = {
            kind: 'cobro',
            partyLabel: 'Cliente',
            partyName: this.customerPaymentPopupAccount?.customerName ?? '-',
            amount: payment.amount,
            date: payment.date,
            methodLabel: this.paymentMethodLabel(payment.method),
            coverage: this.customerPaymentPopupImputaciones.map(item => ({ code: item.code, amount: item.amount })),
            creditAdded: this.customerPaymentPopupCredit
        };
        this.paymentReceiptPdf.generate(data).catch(() => this.toast.error('No se pudo generar el recibo'));
    }

    openPurchasePopup(purchaseId: string): void {
        this.purchasePopupId = purchaseId;
        this.purchasePopupData = null;
        this.purchasePopupLoading = true;
        this.purchaseService.getPurchaseById(purchaseId).subscribe({
            next: data => { this.purchasePopupData = data; this.purchasePopupLoading = false; },
            error: () => { this.purchasePopupLoading = false; this.toast.error('No se pudo cargar el detalle de la compra'); }
        });
    }

    closePurchasePopup(): void { this.purchasePopupId = null; this.purchasePopupData = null; }

    purchasePaymentMethodLabel(method: number): string {
        const map: Record<number, string> = { 1: 'Efectivo', 2: 'Transferencia', 3: 'Cheque', 4: 'Otro' };
        return map[method] ?? 'Otro';
    }

    private refreshOnboarding(force = false): void {
        this.onboardingService.fetchStatus(force).subscribe({
            next: status => {
                this.onboardingStatus = status;
                const nextRoute = this.onboardingService.routeForStep(status.nextStep);

                if (!status.isCompleted && nextRoute && nextRoute !== '/cash') {
                    this.router.navigate([nextRoute]);
                }
            }
        });
    }

}


