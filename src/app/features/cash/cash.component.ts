import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BranchService } from '../../core/services/branch.service';
import { CashService } from '../../core/services/cash.service';
import { BranchResponse } from '../../core/models/branch.models';
import { CashDrawerResponse, CashSessionMovementResponse, CashSessionResponse, CashSessionSummaryResponse, PaymentMethodBreakdownItem } from '../../core/models/cash.models';
import { ToastService } from '../../shared/services/toast.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { OnboardingStatusResponse } from '../../core/models/onboarding.models';
import { OnboardingBannerComponent } from '../../shared/components/onboarding-banner/onboarding-banner.component';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { AuthService } from '../../core/services/auth.service';
import { PermissionCodes } from '../../core/models/permission.models';
import { SaleService } from '../../core/services/sale.service';
import { SaleByIdResponse, SaleResponse } from '../../core/models/sale.models';
import { PurchaseService } from '../../core/services/purchase.service';
import { PurchaseDetailResponse } from '../../core/models/purchase.models';
import { SALE_PAYMENT_METHODS, paymentMethodSummary } from '../../core/models/sale-payment.models';
import { BankService } from '../../core/services/bank.service';
import { BankResponse } from '../../core/models/bank.models';
import { forkJoin } from 'rxjs';
import { SearchableSelectComponent, SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';

type CashSessionView = {
    session: CashSessionResponse;
    expanded: boolean;
    salesIncome: number;
    withdrawals: number;
    expectedClosingAmount: number;
};

@Component({
    selector: 'app-cash',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, OnboardingBannerComponent, SearchableSelectComponent],
    template: `
    <div class="page" [class.page--guided-lock]="isOnboardingFocusLocked">
      <div class="page__glow page__glow--left" aria-hidden="true"></div>
      <div class="page__glow page__glow--right" aria-hidden="true"></div>

      <header class="hero">
        <div class="hero__copy">
          <div class="eyebrow">Tesoreria / Caja</div>
          <h1>Operacion de caja</h1>
          <p>Selecciona una sucursal, administra sus cajas y opera aperturas, cierres e historial.</p>
        </div>
        <div class="hero__rail">
          <article class="hero-stat hero-stat--focus">
            <span class="hero-stat__label">Sucursal activa</span>
            <strong>{{ selectedBranchId ? 'Configurada' : 'Pendiente' }}</strong>
            <small>{{ selectedBranchId ? 'Ya puedes operar sobre sus cajas.' : 'Empieza seleccionando una sucursal.' }}</small>
          </article>
          <article class="hero-stat">
            <span class="hero-stat__label">Cajas visibles</span>
            <strong>{{ drawers.length }}</strong>
            <small>{{ canViewAllCashDrawers ? 'Disponibles en esta sucursal.' : 'Caja asignada al usuario.' }}</small>
          </article>
          <article class="hero-stat">
            <span class="hero-stat__label">Sesion actual</span>
            <strong>{{ currentSession ? 'Abierta' : 'Sin abrir' }}</strong>
            <small>{{ currentSession ? 'Lista para movimientos y cierre.' : 'Abre caja para empezar a operar.' }}</small>
          </article>
          <article class="hero-stat">
            <span class="hero-stat__label">Historial</span>
            <strong>{{ historySessions.length }}</strong>
            <small>Sesiones cargadas en pantalla.</small>
          </article>
        </div>
      </header>

      <app-onboarding-banner
        *ngIf="showCashDrawerOnboarding"
        [step]="2"
        [total]="5"
        [focused]="cashDrawerFocusLocked"
        title="Paso 2. Crea tu primera caja"
        text="Selecciona una sucursal y presiona Entendido para habilitar este paso. Luego usa Crear caja para dejar la estructura minima lista."
        [actionLabel]="cashDrawerFocusLocked ? 'Entendido' : 'Crear caja'"
        [actionDisabled]="!cashDrawerFocusLocked && !selectedBranchId"
        (action)="handleCashDrawerBannerAction()">
      </app-onboarding-banner>

      <app-onboarding-banner
        *ngIf="showInitialCashOpenOnboarding"
        [step]="3"
        [total]="5"
        [focused]="initialCashOpenFocusLocked"
        title="Paso 3. Realiza la apertura inicial"
        text="Lee este paso y presiona Entendido para habilitar la apertura. Abre una caja una sola vez para dejar la operacion lista."
        [actionLabel]="initialCashOpenFocusLocked ? 'Entendido' : ''"
        (action)="acceptInitialCashOpenStep()">
      </app-onboarding-banner>

      <section class="panel panel--setup">
        <div class="panel__header">
          <div class="panel__heading">
            <span>Configurar caja</span>
            <p>Define la sucursal activa y prepara la estructura de trabajo.</p>
          </div>
        </div>
        <div class="grid">
          <label class="field">
            <span>Sucursal</span>
            <app-searchable-select [ngModel]="selectedBranchId" (ngModelChange)="selectBranch($event)" [ngModelOptions]="{ standalone: true }" [options]="branchOptions" placeholder="Selecciona sucursal" searchPlaceholder="Buscar sucursal..." [disabled]="isRestrictedToAssignedDrawer"></app-searchable-select>
          </label>
          <div class="drawer-create">
            <button *ngIf="auth.hasPermission(permissionCodes.cashDrawerManage)" class="btn btn--ghost" type="button" (click)="toggleCreateDrawer()" [disabled]="!selectedBranchId">
              {{ showCreateDrawer ? 'Ocultar alta' : 'Crear caja' }}
            </button>
            <form class="inline-form inline-form--drawer" *ngIf="showCreateDrawer && auth.hasPermission(permissionCodes.cashDrawerManage)" [formGroup]="drawerForm" (ngSubmit)="createDrawer()">
              <input class="control" type="text" placeholder="Caja Principal" formControlName="name" />
              <div class="drawer-create__actions">
                <button class="btn btn--ghost" type="button" (click)="cancelCreateDrawer()">Cancelar</button>
                <button class="btn btn--primary" type="submit">Guardar caja</button>
              </div>
            </form>
          </div>
        </div>

        <div class="empty" *ngIf="branches.length === 0">No hay sucursales disponibles. Crea una desde la seccion Sucursal.</div>

        <div class="empty" *ngIf="selectedBranchId && drawers.length === 0">No hay cajas para esta sucursal.</div>

        <div class="drawer-strip" *ngIf="canViewAllCashDrawers && drawers.length > 0" [class.drawer-strip--attention]="!selectedDrawerId">
          <div class="drawer-strip__intro">
            <span class="drawer-strip__label">Elegir caja</span>
            <strong class="drawer-strip__title">Selecciona una caja para operar</strong>
            <span class="drawer-strip__hint">
              {{ selectedDrawerId ? 'Caja seleccionada lista para abrir, cerrar o revisar historial.' : 'Primero elige una caja de la sucursal para continuar.' }}
            </span>
          </div>
          <div class="drawer-list">
            <button
              type="button"
              class="drawer-chip"
              *ngFor="let drawer of drawers"
              [class.drawer-chip--active]="drawer.id === selectedDrawerId"
              (click)="selectDrawer(drawer.id)">
              <span class="drawer-chip__name">{{ drawer.name }}</span>
              <span class="drawer-chip__state">{{ drawer.id === selectedDrawerId ? 'Seleccionada' : 'Disponible' }}</span>
            </button>
          </div>
        </div>
      </section>

      <section class="panel panel--session" *ngIf="selectedDrawerId">
        <div class="panel__header">
          <div class="panel__heading">
            <span>Sesion actual</span>
            <p>Control en vivo de la caja seleccionada.</p>
          </div>
        </div>

        <div class="empty" *ngIf="loadingSession">Cargando sesion...</div>

        <div *ngIf="!loadingSession && !currentSession">
            <form *ngIf="auth.hasPermission(permissionCodes.cashOpen)" class="inline-form" [formGroup]="openForm" (ngSubmit)="openSession()">
              <input class="control" type="number" min="0" step="0.01" placeholder="Monto inicial" formControlName="openingAmount" />
              <input class="control" type="text" placeholder="Notas" formControlName="notes" />
            <button class="btn btn--primary" type="submit">{{ showInitialCashOpenOnboarding ? 'Abrir caja inicial' : 'Abrir caja' }}</button>
            </form>
          </div>

        <div *ngIf="currentSession" class="session-card">
          <div class="stale-alert" *ngIf="isCurrentSessionStale">
            &#9888; Esta caja lleva mas de 20 horas abierta. Recorda cerrarla al final del turno.
          </div>
          <div class="session-metrics">
            <div class="metric-inline">
              <span class="metric-inline__label">Abierta</span>
              <strong>{{ currentSession.openedAt | date: 'short' }}</strong>
            </div>
            <div class="metric-inline">
              <span class="metric-inline__label">Inicial</span>
              <strong>&#36;{{ currentSession.openingAmount | number: '1.2-2' }}</strong>
            </div>
            <div class="metric-inline">
              <span class="metric-inline__label">Esperado</span>
              <strong>&#36;{{ (currentSummary?.expectedClosingAmount ?? currentSession.expectedClosingAmount) | number: '1.2-2' }}</strong>
            </div>
          </div>

          <div *ngIf="auth.hasPermission(permissionCodes.cashWithdraw)" class="session-actions">
            <button class="btn btn--ghost" type="button" (click)="openWithdrawModal()">Registrar extraccion</button>
            <button *ngIf="otherDrawers.length > 0" class="btn btn--transfer" type="button" (click)="openTransferModal()">&#8644; Transferir</button>
          </div>

          <button *ngIf="auth.hasPermission(permissionCodes.cashClose)" class="btn btn--danger" type="button" (click)="startCloseSessionFlow()" [disabled]="checkingPendingCloseSales">Cerrar caja</button>

          <div class="summary" *ngIf="currentSummary">
            <div class="summary-item summary-item--sales">
              <span>Ventas</span>
              <strong>&#36;{{ currentSummary.salesIncome | number: '1.2-2' }}</strong>
            </div>
            <div class="summary-item summary-item--withdrawals">
              <span>Extracciones</span>
              <strong>&#36;{{ currentSummary.withdrawals | number: '1.2-2' }}</strong>
            </div>
            <div class="summary-item summary-item--cancellations" *ngIf="currentSummary.salesCancellations > 0">
              <span>Cancelaciones</span>
              <strong>&#36;{{ currentSummary.salesCancellations | number: '1.2-2' }}</strong>
            </div>
            <div class="summary-item summary-item--balance">
              <span>Diferencia</span>
              <strong>&#36;{{ currentSummary.difference | number: '1.2-2' }}</strong>
            </div>
          </div>

          <div class="session-breakdown" *ngIf="currentSession?.paymentBreakdown?.length">
            <span *ngFor="let bd of currentSession!.paymentBreakdown; let last = last">
              <span class="session-breakdown__label">{{ bd.methodName }}</span>
              <strong class="session-breakdown__amount">&#36;{{ (bd.amount + (bd.surchargeAmount ?? 0)) | number: '1.2-2' }}</strong>
              <span class="session-breakdown__sep" *ngIf="!last"> | </span>
            </span>
          </div>

          <div class="transfer-bank-breakdown" *ngIf="currentTransferBankBreakdown.length > 0">
            <span class="transfer-bank-breakdown__title">Transferencias por banco <span class="transfer-bank-breakdown__note">(no incluido en caja)</span></span>
            <span *ngFor="let tb of currentTransferBankBreakdown; let last = last">
              <span class="session-breakdown__label">{{ tb.bankName }}</span>
              <strong class="session-breakdown__amount">&#36;{{ tb.amount | number: '1.2-2' }}</strong>
              <span class="session-breakdown__sep" *ngIf="!last"> | </span>
            </span>
          </div>
          <div class="transfer-bank-breakdown" *ngIf="currentCardBankBreakdown.length > 0">
            <span class="transfer-bank-breakdown__title">Tarjetas por banco <span class="transfer-bank-breakdown__note">(no incluido en caja)</span></span>
            <span *ngFor="let cb of currentCardBankBreakdown; let last = last">
              <span class="session-breakdown__label">{{ cb.bankName }}</span>
              <strong class="session-breakdown__amount">&#36;{{ cb.amount | number: '1.2-2' }}</strong>
              <span class="session-breakdown__sep" *ngIf="!last"> | </span>
            </span>
          </div>
        </div>
      </section>

      <section class="panel panel--history" *ngIf="selectedDrawerId">
        <div class="panel__header panel__header--actions">
          <div class="panel__heading">
            <span>Historial de caja</span>
            <p>Revisa sesiones cerradas, movimientos y exportaciones.</p>
          </div>
          <div class="history-header-actions">
            <span>{{ historySessions.length }} sesiones</span>
            <button *ngIf="auth.hasPermission(permissionCodes.cashHistoryExport)" class="btn btn--ghost btn--export" type="button" (click)="exportFilteredHistory()" [disabled]="historySessions.length === 0">Exportar caja XLSX</button>
            <button *ngIf="auth.hasPermission(permissionCodes.cashHistoryExport)" class="btn btn--ghost btn--pdf" type="button" (click)="exportFilteredHistoryPdf()" [disabled]="historySessions.length === 0">Exportar caja PDF</button>
          </div>
        </div>

        <div class="history-filters">
          <label class="field">
            <span>Desde</span>
            <input class="control" type="date" [(ngModel)]="historyFrom" [ngModelOptions]="{ standalone: true }" />
          </label>
          <label class="field">
            <span>Hasta</span>
            <input class="control" type="date" [(ngModel)]="historyTo" [ngModelOptions]="{ standalone: true }" />
          </label>
          <button class="btn btn--ghost" type="button" (click)="applyHistoryFilters()">Aplicar</button>
          <button class="btn btn--ghost" type="button" (click)="clearHistoryFilters()" [disabled]="!historyFrom && !historyTo">Limpiar</button>
        </div>

        <div class="empty" *ngIf="loadingHistory">Cargando historial...</div>
        <div class="empty" *ngIf="!loadingHistory && historySessions.length === 0">No hay sesiones para ese rango en esta caja.</div>

        <div class="history-group" *ngIf="historySessions.length > 0">
          <article class="history-session" *ngFor="let item of historySessions" [class.history-session--closed]="isClosedSession(item.session.statusName)" [class.history-session--open]="!isClosedSession(item.session.statusName)">
            <button type="button" class="history-session__summary" (click)="toggleSession(item.session.id)">
              <div class="history-session__headline">
                <strong>{{ item.session.openedAt | date: 'short' }}</strong>
                <span [class.history-session__status--closed]="isClosedSession(item.session.statusName)">{{ item.session.statusName }}</span>
              </div>
              <div class="history-session__metrics">
                <span>Inicial: &#36;{{ item.session.openingAmount | number: '1.2-2' }}</span>
                <span>Ventas: &#36;{{ item.salesIncome | number: '1.2-2' }}</span>
                <span>Extracciones: &#36;{{ item.withdrawals | number: '1.2-2' }}</span>
                <span>Esperado: &#36;{{ item.expectedClosingAmount | number: '1.2-2' }}</span>
              </div>
            </button>

            <div class="history-session__body" *ngIf="item.expanded">
              <div class="session-breakdown" *ngIf="computePaymentBreakdown(item.session).length > 0">
                <span *ngFor="let bd of computePaymentBreakdown(item.session); let last = last">
                  <span class="session-breakdown__label">{{ bd.methodName }}</span>
                  <strong class="session-breakdown__amount">&#36;{{ (bd.amount + (bd.surchargeAmount ?? 0)) | number: '1.2-2' }}</strong>
                  <span class="session-breakdown__sep" *ngIf="!last"> | </span>
                </span>
              </div>

              <div class="transfer-bank-breakdown" *ngIf="computeTransferBankBreakdown(item.session).length > 0">
                <span class="transfer-bank-breakdown__title">Transferencias por banco <span class="transfer-bank-breakdown__note">(no incluido en caja)</span></span>
                <span *ngFor="let tb of computeTransferBankBreakdown(item.session); let last = last">
                  <span class="session-breakdown__label">{{ tb.bankName }}</span>
                  <strong class="session-breakdown__amount">&#36;{{ tb.amount | number: '1.2-2' }}</strong>
                  <span class="session-breakdown__sep" *ngIf="!last"> | </span>
                </span>
              </div>

              <div class="transfer-bank-breakdown" *ngIf="computeCardBankBreakdown(item.session).length > 0">
                <span class="transfer-bank-breakdown__title">Tarjetas por banco <span class="transfer-bank-breakdown__note">(no incluido en caja)</span></span>
                <span *ngFor="let cb of computeCardBankBreakdown(item.session); let last = last">
                  <span class="session-breakdown__label">{{ cb.bankName }}</span>
                  <strong class="session-breakdown__amount">&#36;{{ cb.amount | number: '1.2-2' }}</strong>
                  <span class="session-breakdown__sep" *ngIf="!last"> | </span>
                </span>
              </div>

              <div class="history-session__toolbar">
                <span>Cierre real: {{ item.session.actualClosingAmount == null ? '-' : ('$' + (item.session.actualClosingAmount | number: '1.2-2')) }}</span>
                <span>Diferencia: &#36;{{ item.session.difference | number: '1.2-2' }}</span>
                <button *ngIf="auth.hasPermission(permissionCodes.cashHistoryExport)" class="btn btn--ghost btn--export" type="button" (click)="exportSession(item.session, item.expectedClosingAmount)">Exportar sesion XLSX</button>
                <button *ngIf="auth.hasPermission(permissionCodes.cashHistoryExport)" class="btn btn--ghost btn--pdf" type="button" (click)="exportSessionPdf(item.session, item.expectedClosingAmount)">Exportar sesion PDF</button>
              </div>

              <div class="history-table">
                <table>
                  <thead>
                    <tr>
                      <th>Movimiento</th>
                      <th>Tipo</th>
                      <th>Sentido</th>
                      <th>Monto</th>
                      <th>Medio de pago</th>
                      <th>Codigo venta</th>
                      <th>Usuario</th>
                      <th>Descripcion</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of getDisplayRows(item.session)"
                      [class.history-table__row--clickable]="(row.typeName === 'CuentaCorrienteIncome' || row.typeName === 'SaleCancellation' || row.typeName === 'PurchaseExpense') && row.referenceId"
                      (click)="row.typeName === 'CuentaCorrienteIncome' && row.referenceId ? openCcPopup(row.referenceId) : row.typeName === 'SaleCancellation' && row.referenceId ? openCancelDetailPopup(row) : row.typeName === 'PurchaseExpense' && row.referenceId ? openPurchasePopup(row.referenceId) : null">
                      <td>{{ row.occurredAt | date: 'short' }}</td>
                      <td><span class="badge badge--type" [attr.data-type]="row.typeName">{{ translateType(row.typeName) }}</span></td>
                      <td><span class="badge" [class.badge--in]="row.directionName === 'In'" [class.badge--out]="row.directionName === 'Out'">{{ translateDirection(row.directionName) }}</span></td>
                      <td>&#36;{{ row.amount | number: '1.2-2' }}</td>
                      <td>{{ row.paymentMethodLabel }}</td>
                      <td><span class="sale-code-ref" *ngIf="row.saleCode">{{ row.saleCode }}</span><span *ngIf="!row.saleCode">-</span></td>
                      <td><span class="username-ref" *ngIf="row.username">{{ row.username }}</span><span *ngIf="!row.username">-</span></td>
                      <td>{{ translateDescription(row.description) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>

    <!-- Close Confirm Modal -->
    <div class="modal-backdrop" *ngIf="showCloseConfirmModal" (click)="closeCloseConfirmModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal__head">
          <span class="modal__title">Confirmar cierre de caja</span>
          <button class="modal__close" type="button" (click)="closeCloseConfirmModal()">&#x2715;</button>
        </div>
        <div class="modal__body">
          <form [formGroup]="closeForm" (ngSubmit)="closeSession()">
            <div class="close-confirm-row">
              <span class="close-confirm-row__label">Esperado en caja</span>
              <strong class="close-confirm-row__value">&#36;{{ (currentSummary?.expectedClosingAmount ?? 0) | number: '1.2-2' }}</strong>
            </div>
            <label class="field">
              <span>Recuento de efectivo</span>
              <input class="control" type="number" min="0" step="0.01" placeholder="Ingrese el conteo real" formControlName="actualClosingAmount" autofocus />
            </label>
            <div class="close-confirm-row" *ngIf="closeForm.get('actualClosingAmount')?.value !== null && closeForm.get('actualClosingAmount')?.value !== ''">
              <span class="close-confirm-row__label">Diferencia</span>
              <strong class="close-confirm-row__value" [class.close-confirm-row__value--neg]="closeDifference < 0" [class.close-confirm-row__value--pos]="closeDifference > 0">
                {{ closeDifference >= 0 ? '+' : '' }}&#36;{{ closeDifference | number: '1.2-2' }}
              </strong>
            </div>
            <label class="field">
              <span>Notas <span style="font-weight:400;opacity:.6">(opcional)</span></span>
              <input class="control" type="text" placeholder="Notas opcionales" formControlName="notes" />
            </label>
            <div class="modal__actions">
              <button class="btn btn--ghost" type="button" (click)="closeCloseConfirmModal()">Cancelar</button>
              <button class="btn btn--danger" type="submit" [disabled]="closeForm.invalid">Confirmar cierre</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Withdraw Modal -->
    <div class="modal-backdrop" *ngIf="showWithdrawModal" (click)="closeWithdrawModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal__head">
          <span class="modal__title">Registrar extraccion</span>
          <button class="modal__close" type="button" (click)="closeWithdrawModal()">&#x2715;</button>
        </div>
        <div class="modal__body">
          <form [formGroup]="withdrawForm" (ngSubmit)="withdraw()">
            <label class="field">
              <span>Monto</span>
              <input class="control" type="number" min="0.01" step="0.01" placeholder="0.00" formControlName="amount" />
            </label>
            <label class="field">
              <span>Motivo</span>
              <input class="control" type="text" placeholder="Motivo de la extraccion" formControlName="description" />
            </label>
            <div class="modal__actions">
              <button class="btn btn--ghost" type="button" (click)="closeWithdrawModal()">Cancelar</button>
              <button class="btn btn--ghost" type="submit" [disabled]="withdrawForm.invalid">Confirmar extraccion</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div class="modal-backdrop" *ngIf="showPendingCloseSalesModal" (click)="closePendingCloseSalesModal()">
      <div class="modal modal--pending-close" (click)="$event.stopPropagation()">
        <div class="modal__head">
          <span class="modal__title">No se puede cerrar la caja</span>
          <button class="modal__close" type="button" (click)="closePendingCloseSalesModal()">&#x2715;</button>
        </div>
        <div class="modal__body">
          <div class="pending-close-copy">
            <p>Hay ventas en espera asociadas a esta caja. Primero tienen que resolverse antes de cerrar la caja.</p>
            <div class="pending-close-total">
              <span>Ventas bloqueantes</span>
              <strong>{{ pendingCloseSales.length }}</strong>
            </div>
          </div>

          <div class="pending-close-list">
            <article class="pending-close-sale" *ngFor="let sale of pendingCloseSales">
              <div class="pending-close-sale__row">
                <span class="pending-close-sale__code">{{ sale.code || 'S/N' }}</span>
                <strong class="pending-close-sale__amount">&#36;{{ getBlockingSaleAmount(sale) | number:'1.2-2' }}</strong>
              </div>
              <div class="pending-close-sale__meta">
                <span>{{ sale.customerFullName || 'Sin cliente' }}</span>
                <span>{{ sale.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
              </div>
            </article>
          </div>

          <div class="modal__actions">
            <button class="btn btn--ghost" type="button" (click)="closePendingCloseSalesModal()">Entendido</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Transfer Modal -->
    <div class="modal-backdrop" *ngIf="showTransferModal" (click)="closeTransferModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal__head">
          <span class="modal__title">&#8644; Pase entre cajas</span>
          <button class="modal__close" type="button" (click)="closeTransferModal()">&#x2715;</button>
        </div>
        <div class="modal__body">
          <form [formGroup]="transferForm" (ngSubmit)="submitTransfer()">
            <label class="field">
              <span>Caja destino</span>
              <app-searchable-select formControlName="targetCashDrawerId" [options]="otherDrawerOptions" placeholder="Selecciona caja destino" searchPlaceholder="Buscar caja..."></app-searchable-select>
            </label>
            <label class="field">
              <span>Monto</span>
              <input class="control" type="number" min="0.01" step="0.01" placeholder="0.00" formControlName="amount" />
            </label>
            <label class="field">
              <span>Descripcion</span>
              <input class="control" type="text" placeholder="Motivo del pase" formControlName="description" />
            </label>
            <div class="modal__actions">
              <button class="btn btn--ghost" type="button" (click)="closeTransferModal()">Cancelar</button>
              <button class="btn btn--transfer btn--transfer-confirm" type="submit" [disabled]="transferForm.invalid">Confirmar transferencia</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- CC Sale Popup -->
    <div class="modal-backdrop" *ngIf="ccPopupSaleId" (click)="closeCcPopup()">
      <div class="modal modal--cc-popup" (click)="$event.stopPropagation()">
        <div class="modal__head modal__head--cc-popup">
          <div class="cc-popup-head">
            <span class="cc-popup-head__eyebrow">Movimiento vinculado</span>
            <span class="modal__title">Detalle cuenta corriente</span>
          </div>
          <button class="modal__close" type="button" (click)="closeCcPopup()">&#x2715;</button>
        </div>
        <div class="modal__body modal__body--cc-popup" *ngIf="ccPopupLoading">
          <div class="cc-popup-loading">
            <span class="cc-popup-loading__dot" aria-hidden="true"></span>
            <p>Cargando detalle de la cuenta…</p>
          </div>
        </div>
        <ng-container *ngIf="!ccPopupLoading && ccPopupSale as sale">
          <div class="cc-popup-body">
            <div class="cc-popup-hero">
              <div class="cc-popup-header__row">
                <span class="cc-popup-header__code">{{ sale.code || 'S/N' }}</span>
                <span class="badge"
                  [class.badge--in]="sale.idSaleStatus === 2"
                  [class.badge--out]="sale.idSaleStatus === 3"
                  [class.badge--type]="sale.idSaleStatus !== 2 && sale.idSaleStatus !== 3">
                  {{ sale.idSaleStatus === 3 ? 'Cancelada' : sale.idSaleStatus === 2 ? 'Pagada' : (sale.ccPaidTotal > 0 && sale.ccPaidTotal < sale.totalAmount) ? 'Pago parcial' : 'En espera' }}
                </span>
              </div>
              <div class="cc-popup-header__meta">
                <span>{{ sale.customerFullName || 'Sin cliente' }}</span>
                <span>{{ sale.createdAt | date:'dd/MM/yyyy' }}</span>
              </div>
              <p class="cc-popup-hero__copy">Consulta el estado general de la cuenta y el historial de pagos aplicados a esta venta.</p>
            </div>

            <div class="cc-popup-totals">
              <div class="cc-popup-totals__card">
                <span class="cc-popup-totals__label">Total venta</span>
                <strong>&#36;{{ sale.totalAmount | number:'1.2-2' }}</strong>
              </div>
              <div class="cc-popup-totals__card cc-popup-totals__card--paid">
                <span class="cc-popup-totals__label">Cobrado</span>
                <strong>&#36;{{ sale.ccPaidTotal | number:'1.2-2' }}</strong>
              </div>
              <div class="cc-popup-totals__card cc-popup-totals__card--pending">
                <span class="cc-popup-totals__label">Pendiente</span>
                <strong>&#36;{{ sale.ccPendingAmount | number:'1.2-2' }}</strong>
              </div>
            </div>

            <div class="cc-popup-payments">
              <div class="cc-popup-payments__head">
                <div>
                  <span class="cc-popup-payments__title">Historial de pagos</span>
                  <strong>{{ ccPopupPayments.length }} registro{{ ccPopupPayments.length === 1 ? '' : 's' }}</strong>
                </div>
              </div>
              <div *ngIf="ccPopupPayments.length === 0" class="cc-popup-payments__empty">Sin pagos registrados</div>
              <div *ngFor="let p of ccPopupPayments" class="cc-popup-payment" [class.cc-popup-payment--cancelled]="p.status === 2">
                <div class="cc-popup-payment__row">
                  <div class="cc-popup-payment__copy">
                    <span class="cc-popup-payment__date">{{ p.date | date:'dd/MM/yyyy' }}</span>
                    <span class="cc-popup-payment__method">{{ paymentMethodLabel(p.idPaymentMethod) }}</span>
                  </div>
                  <span class="cc-popup-payment__amount">&#36;{{ p.amount | number:'1.2-2' }}</span>
                  <span class="badge" [class.badge--in]="p.status === 1" [class.badge--out]="p.status !== 1">{{ p.status === 1 ? 'Activo' : 'Anulado' }}</span>
                </div>
              </div>
            </div>
          </div>
        </ng-container>
      </div>
    </div>

    <!-- Purchase Popup -->
    <div class="modal-backdrop" *ngIf="purchasePopupId" (click)="closePurchasePopup()">
      <div class="modal modal--purchase-popup" (click)="$event.stopPropagation()">
        <div class="modal__head modal__head--purchase-popup">
          <div class="purchase-popup-head">
            <span class="purchase-popup-head__eyebrow">Movimiento vinculado</span>
            <span class="modal__title">Detalle compra proveedor</span>
          </div>
          <button class="modal__close" type="button" (click)="closePurchasePopup()">&#x2715;</button>
        </div>
        <div class="modal__body modal__body--purchase-popup" *ngIf="purchasePopupLoading">
          <div class="purchase-popup-loading">
            <span class="purchase-popup-loading__dot" aria-hidden="true"></span>
            <p>Cargando detalle de la compra…</p>
          </div>
        </div>
        <ng-container *ngIf="!purchasePopupLoading && purchasePopupData as purchase">
          <div class="purchase-popup-body">
            <div class="purchase-popup-hero">
              <div class="purchase-popup-header__row">
                <span class="purchase-popup-header__code">{{ purchase.code }}</span>
                <span class="badge"
                  [class.badge--in]="purchase.status === 2"
                  [class.badge--out]="purchase.status === 3"
                  [class.badge--type]="purchase.status === 1">
                  {{ purchase.statusName }}
                </span>
              </div>
              <div class="purchase-popup-header__meta">
                <span>{{ purchase.supplierName || 'Sin proveedor' }}</span>
                <span *ngIf="purchase.invoiceNumber">Factura: {{ purchase.invoiceNumber }}</span>
                <span>{{ purchase.createdAt | date:'dd/MM/yyyy' }}</span>
                <span *ngIf="purchase.ivaPct != null">IVA {{ purchase.ivaPct }}%</span>
                <span *ngIf="purchase.ingresosBrutosPct != null">IIBB {{ purchase.ingresosBrutosPct }}%</span>
              </div>
            </div>

            <div class="purchase-popup-totals">
              <div class="purchase-popup-totals__card">
                <span class="purchase-popup-totals__label">Total compra</span>
                <strong>&#36;{{ purchase.totalAmount | number:'1.2-2' }}</strong>
              </div>
              <div class="purchase-popup-totals__card purchase-popup-totals__card--paid">
                <span class="purchase-popup-totals__label">Pagado</span>
                <strong>&#36;{{ purchase.totalPaid | number:'1.2-2' }}</strong>
              </div>
              <div class="purchase-popup-totals__card purchase-popup-totals__card--pending">
                <span class="purchase-popup-totals__label">Pendiente</span>
                <strong>&#36;{{ purchase.pendingAmount | number:'1.2-2' }}</strong>
              </div>
            </div>

            <div class="purchase-popup-products">
              <div class="purchase-popup-section-title">Productos</div>
              <div class="purchase-popup-products__table">
                <div class="purchase-popup-products__head">
                  <span>Producto</span>
                  <span>Cantidad</span>
                  <span>Costo unit.</span>
                  <span>Subtotal</span>
                </div>
                <div *ngFor="let d of purchase.details" class="purchase-popup-products__row">
                  <span>{{ d.productName }}</span>
                  <span>{{ d.quantity }}</span>
                  <span>&#36;{{ d.unitCost | number:'1.2-2' }}</span>
                  <span>&#36;{{ d.totalAmount | number:'1.2-2' }}</span>
                </div>
                <div *ngIf="purchase.details.length === 0" class="purchase-popup-products__empty">Sin productos registrados</div>
              </div>
            </div>

            <div class="purchase-popup-payments">
              <div class="purchase-popup-section-title">Pagos registrados</div>
              <div *ngIf="purchase.payments.length === 0" class="purchase-popup-payments__empty">Sin pagos registrados</div>
              <div *ngFor="let p of purchase.payments" class="purchase-popup-payment">
                <div class="purchase-popup-payment__row">
                  <div class="purchase-popup-payment__copy">
                    <span class="purchase-popup-payment__date">{{ p.date | date:'dd/MM/yyyy' }}</span>
                    <span class="purchase-popup-payment__method">{{ purchasePaymentMethodLabel(p.method) }}</span>
                  </div>
                  <strong class="purchase-popup-payment__amount">&#36;{{ p.amount | number:'1.2-2' }}</strong>
                </div>
              </div>
            </div>
          </div>
        </ng-container>
      </div>
    </div>

    <!-- Cancel Detail Popup -->
    <div class="modal-backdrop" *ngIf="cancelDetailPopupRow" (click)="closeCancelDetailPopup()">
      <div class="modal modal--cancel-detail-popup" (click)="$event.stopPropagation()">
        <div class="modal__head modal__head--cancel-detail">
          <div class="cancel-detail-head">
            <span class="cancel-detail-head__eyebrow">Referencia cruzada</span>
            <span class="modal__title">Detalle de anulación</span>
          </div>
          <button class="modal__close" type="button" (click)="closeCancelDetailPopup()">&#x2715;</button>
        </div>
        <div class="modal__body modal__body--cancel-detail">
          <div class="cancel-detail-hero">
            <span class="cancel-detail-hero__kicker">Venta anulada vinculada</span>
            <strong class="cancel-detail-hero__code">{{ cancelDetailPopupRow.saleCode || '—' }}</strong>
            <span class="cancel-detail-hero__copy">Esta anulación corresponde a una venta registrada originalmente en otra caja.</span>
          </div>

          <div class="cancel-detail-meta-grid">
            <div class="cancel-detail-meta-card">
              <span class="cancel-detail-meta-card__label">Anulada el</span>
              <strong>{{ cancelDetailPopupRow.occurredAt | date:'short' }}</strong>
            </div>
            <ng-container *ngIf="cancelDetailPopupRow.originalCashSessionId">
              <div class="cancel-detail-meta-card">
                <span class="cancel-detail-meta-card__label">Sesión original</span>
                <strong class="cancel-detail-session-id">{{ cancelDetailPopupRow.originalCashSessionId | slice:0:8 }}…</strong>
              </div>
            </ng-container>
          </div>

          <ng-container *ngIf="cancelDetailSale as sale">
            <div class="cancel-detail-section-title">Pagos originales</div>
            <div class="cancel-detail-payments">
              <div *ngFor="let p of (sale.payments ?? [])" class="cancel-detail-payment">
                <div class="cancel-detail-payment__copy">
                  <span class="cancel-detail-payment__method">{{ p.paymentMethodName || 'Método' }}</span>
                  <span class="cancel-detail-payment__note">Registrado en la venta original</span>
                </div>
                <strong class="cancel-detail-payment__amount">&#36;{{ p.amount | number:'1.2-2' }}</strong>
              </div>
              <div *ngIf="(sale.payments ?? []).length === 0" class="cancel-detail-payments__empty">Sin información de pagos</div>
            </div>
            <div class="cancel-detail-total">
              <span class="cancel-detail-total__label">Total original</span>
              <strong>&#36;{{ sale.totalAmount | number:'1.2-2' }}</strong>
            </div>
          </ng-container>
          <ng-container *ngIf="!cancelDetailSale">
            <div class="cancel-detail-loading">
              <span class="cancel-detail-loading__dot" aria-hidden="true"></span>
              <p>Cargando datos de la venta…</p>
            </div>
          </ng-container>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .page{position:relative;min-height:calc(100vh - 64px);background:linear-gradient(180deg,var(--bg) 0%,var(--bg-elevated) 100%);padding:2.6rem 1.6rem 3rem;max-width:1240px;margin:0 auto;overflow:visible}
    .page__glow{position:absolute;width:28rem;height:28rem;border-radius:50%;pointer-events:none;filter:blur(18px);opacity:.52}
    .page__glow--left{top:-10rem;left:-11rem;background:radial-gradient(circle,color-mix(in srgb,var(--amber) 18%, transparent) 0%,transparent 70%)}
    .page__glow--right{top:8rem;right:-13rem;background:radial-gradient(circle,color-mix(in srgb,var(--success) 12%, transparent) 0%,transparent 72%)}
    .page--guided-lock .panel{opacity:.34;pointer-events:none;filter:saturate(.7)}
    .hero,.panel{position:relative;z-index:1}
    .hero{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(21rem,.95fr);gap:1.2rem;align-items:stretch;margin-bottom:1.35rem}
    .hero__copy{padding:1.6rem 1.7rem;border:1px solid color-mix(in srgb,var(--amber) 18%, var(--border));border-radius:28px;background:linear-gradient(140deg,color-mix(in srgb,var(--bg-panel) 88%, transparent) 0%,color-mix(in srgb,var(--bg) 96%, transparent) 100%);box-shadow:inset 0 1px 0 color-mix(in srgb,white 10%, transparent),0 24px 60px rgba(0,0,0,.18)}
    .hero h1{margin:0;color:var(--text);font-family:'Crimson Pro',serif;font-size:clamp(2.3rem,4.8vw,4rem);line-height:.92;max-width:10ch}
    .hero p{margin:1rem 0 0;max-width:42rem;color:color-mix(in srgb,var(--text) 72%, var(--text-soft));font-family:'DM Mono',monospace;font-size:.88rem;line-height:1.75;letter-spacing:.03em}
    .eyebrow{display:inline-flex;padding:.42rem .72rem;border:1px solid color-mix(in srgb,var(--amber) 30%, transparent);border-radius:999px;color:var(--amber);background:color-mix(in srgb,var(--amber) 8%, transparent);margin-bottom:.9rem;font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.16em;text-transform:uppercase}
    .hero__rail{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.9rem}
    .hero-stat{display:grid;gap:.42rem;align-content:space-between;min-height:9.8rem;padding:1.1rem 1.15rem;border:1px solid var(--border);border-radius:22px;background:linear-gradient(180deg,color-mix(in srgb,var(--bg-panel) 94%, transparent) 0%,color-mix(in srgb,var(--bg) 97%, transparent) 100%);box-shadow:inset 0 1px 0 color-mix(in srgb,white 9%, transparent),0 18px 40px rgba(0,0,0,.12)}
    .hero-stat--focus{border-color:color-mix(in srgb,var(--amber) 28%, var(--border));background:linear-gradient(145deg,color-mix(in srgb,var(--amber) 10%, var(--bg-panel)) 0%,color-mix(in srgb,var(--bg) 97%, transparent) 100%)}
    .hero-stat__label,.panel__header span{font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase}
    .hero-stat__label{color:var(--text-dim)}
    .hero-stat strong{color:var(--text);font-family:'Crimson Pro',serif;font-size:clamp(1.55rem,2.6vw,2.2rem);line-height:.95}
    .hero-stat small{color:var(--text-soft);font-family:'DM Mono',monospace;font-size:.72rem;line-height:1.55}
    .panel{background:linear-gradient(180deg,color-mix(in srgb,var(--bg-panel) 95%, transparent) 0%,color-mix(in srgb,var(--bg) 98%, transparent) 100%);border:1px solid var(--border);border-radius:28px;padding:1.2rem;margin-bottom:1rem;box-shadow:inset 0 1px 0 color-mix(in srgb,white 8%, transparent),0 18px 46px rgba(0,0,0,.12);overflow:visible}
    .panel--session{border-color:color-mix(in srgb,var(--amber) 18%, var(--border))}
    .panel__header{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:1rem;padding-bottom:.9rem;border-bottom:1px solid var(--border)}
    .panel__header--actions{gap:1rem}
    .panel__heading{display:grid;gap:.28rem}
    .panel__header span{color:var(--text)}
    .panel__heading p{margin:0;color:var(--text-soft);font-family:'DM Mono',monospace;font-size:.76rem;line-height:1.5}
    .grid{display:grid;gap:1rem}
    .field span{display:block;margin-bottom:.45rem;color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase}
    .inline-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;align-items:end}.inline-form--drawer{grid-template-columns:minmax(0,1fr) auto}
    .drawer-create{display:grid;gap:.85rem;align-content:start}
    .drawer-create__actions{display:flex;gap:.75rem}
    .control{width:100%;box-sizing:border-box;border:1px solid var(--border-2);background:color-mix(in srgb,var(--bg-panel) 84%, var(--bg));color:var(--text);padding:.88rem 1rem;font-family:'DM Mono',monospace;font-size:.84rem;border-radius:16px;outline:none;transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease}
    .control:focus{transform:translateY(-1px);border-color:color-mix(in srgb,var(--amber) 34%, var(--border-2));box-shadow:0 0 0 3px color-mix(in srgb,var(--amber) 10%, transparent)}
    .control--placeholder{color:var(--text-soft)}
    .btn{position:relative;overflow:hidden;min-height:2.9rem;border-radius:16px;padding:.8rem 1rem;font-family:'DM Mono',monospace;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:transform .15s ease,border-color .2s ease,background .2s ease,color .2s ease,box-shadow .2s ease}.btn--primary{border:none;background:linear-gradient(135deg,color-mix(in srgb,var(--amber) 90%, white 10%) 0%,color-mix(in srgb,var(--amber) 68%, black 32%) 100%);color:var(--bg);box-shadow:0 14px 28px color-mix(in srgb,var(--amber) 22%, transparent)}.btn--ghost,.btn--danger{background:color-mix(in srgb,var(--bg) 92%, transparent);border:1px solid var(--border-2);color:var(--text-dim)}.btn--danger{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 35%, var(--border-2))}
    .btn:hover:not(:disabled){transform:translateY(-1px)}
    .btn--primary:hover:not(:disabled){background:color-mix(in srgb,var(--amber) 88%, white 12%);box-shadow:0 8px 16px rgba(0,0,0,.08)}
    .btn--ghost:hover:not(:disabled){border-color:color-mix(in srgb,var(--amber) 28%, var(--border-2));color:var(--text);background:color-mix(in srgb,var(--amber) 6%, transparent)}
    .btn--danger:hover:not(:disabled){border-color:color-mix(in srgb,var(--danger) 45%, var(--border-2));background:color-mix(in srgb,var(--danger) 8%, transparent)}
    .btn--export{border-color:color-mix(in srgb,var(--success) 26%, var(--border-2));color:var(--success);background:color-mix(in srgb,var(--success) 6%, transparent)}
    .btn--export::before{content:'X';display:inline-block;margin-right:.45rem;padding:.08rem .22rem;border:1px solid currentColor;border-radius:4px;font-size:.62rem;line-height:1;font-weight:700}
    .btn--export:hover:not(:disabled){border-color:color-mix(in srgb,var(--success) 48%, var(--border-2));background:color-mix(in srgb,var(--success) 10%, transparent);color:var(--success)}
    .btn--pdf{border-color:color-mix(in srgb,var(--danger) 30%, var(--border-2));color:var(--danger);background:color-mix(in srgb,var(--danger) 6%, transparent)}
    .btn--pdf::before{content:'PDF';display:inline-block;margin-right:.45rem;padding:.08rem .22rem;border:1px solid currentColor;border-radius:4px;font-size:.56rem;line-height:1;font-weight:700;letter-spacing:.06em}
    .btn--pdf:hover:not(:disabled){border-color:color-mix(in srgb,var(--danger) 45%, var(--border-2));background:color-mix(in srgb,var(--danger) 10%, transparent);color:var(--danger)}
    .session-card .btn--ghost{border-color:color-mix(in srgb,var(--amber) 26%, var(--border-2));color:var(--amber);background:color-mix(in srgb,var(--amber) 8%, transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--amber) 10%, transparent)}
    .session-card .btn--ghost:hover:not(:disabled){background:color-mix(in srgb,var(--amber) 14%, transparent);border-color:color-mix(in srgb,var(--amber) 42%, var(--border-2))}
    .session-card .btn--danger{border-color:color-mix(in srgb,var(--danger) 50%, var(--border-2));background:color-mix(in srgb,var(--danger) 8%, transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--danger) 12%, transparent)}
    .session-card .btn--danger:hover:not(:disabled){background:color-mix(in srgb,var(--danger) 14%, transparent);border-color:color-mix(in srgb,var(--danger) 68%, var(--border-2))}
    .btn:disabled{cursor:not-allowed;opacity:.5;filter:saturate(.65)}
    .btn:disabled::after{content:'';position:absolute;left:10%;right:10%;top:50%;height:1px;background:currentColor;opacity:.65;transform:rotate(-8deg);pointer-events:none}
    .payment-breakdown{margin-top:1rem;padding:.85rem 1rem;border:1px solid var(--border);border-radius:3px;background:color-mix(in srgb,var(--bg-soft) 76%, transparent)}
    .payment-breakdown__header{color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;margin-bottom:.65rem}
    .payment-breakdown__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.5rem}
    .payment-breakdown__item{display:flex;flex-direction:column;gap:.15rem;padding:.55rem .75rem;border:1px solid var(--border);border-radius:3px;background:color-mix(in srgb,var(--bg-panel) 90%, transparent)}
    .payment-breakdown__label{color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.65rem;letter-spacing:.1em;text-transform:uppercase}
    .payment-breakdown__amount{color:var(--success);font-family:'DM Mono',monospace;font-size:.88rem;font-weight:600}
    .drawer-strip{display:grid;grid-template-columns:minmax(220px,280px) 1fr;gap:1rem;align-items:start;margin-top:1rem;padding:1rem;border:1px solid color-mix(in srgb,var(--border) 78%, transparent);background:linear-gradient(180deg,color-mix(in srgb,var(--bg-soft) 70%, transparent) 0%,color-mix(in srgb,var(--bg-panel) 84%, transparent) 100%);border-radius:22px}
    .drawer-strip--attention{border-color:color-mix(in srgb,var(--amber) 34%, var(--border));box-shadow:0 0 0 2px color-mix(in srgb,var(--amber) 9%, transparent)}
    .drawer-strip__intro{display:grid;gap:.35rem;padding-bottom:1rem}
    .drawer-strip__label{color:var(--amber);font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.16em;text-transform:uppercase}
    .drawer-strip__title{color:var(--text);font-family:'DM Mono',monospace;font-size:.82rem;line-height:1.45}
    .drawer-strip__hint{color:var(--text-soft);font-family:'DM Mono',monospace;font-size:.7rem;line-height:1.5}
    .drawer-list{display:flex;flex-wrap:wrap;gap:.65rem;padding-bottom:1rem}
    .drawer-chip{min-width:180px;display:grid;gap:.25rem;align-content:start;text-align:left;border:1px solid color-mix(in srgb,var(--border-2) 88%, transparent);background:color-mix(in srgb,var(--bg-panel) 92%, transparent);color:var(--text-dim);padding:.7rem .85rem;cursor:pointer;font-family:'DM Mono',monospace;font-size:.72rem;line-height:1.2;border-radius:16px;transition:border-color .2s ease,background .2s ease,color .2s ease,transform .15s ease,box-shadow .2s ease}
    .drawer-chip:hover{border-color:color-mix(in srgb,var(--amber) 28%, var(--border-2));color:var(--text);background:color-mix(in srgb,var(--amber) 5%, transparent);transform:translateY(-1px)}
    .drawer-chip__name{color:inherit}
    .drawer-chip__state{font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-soft)}
    .drawer-chip--active{border-color:color-mix(in srgb,var(--amber) 42%, var(--border-2));background:color-mix(in srgb,var(--amber) 11%, transparent);color:var(--amber);box-shadow:0 0 0 2px color-mix(in srgb,var(--amber) 8%, transparent)}
    .drawer-chip--active .drawer-chip__state{color:color-mix(in srgb,var(--amber) 72%, white 28%)}
    .stale-alert{padding:.78rem 1rem;border:1px solid color-mix(in srgb,var(--amber) 38%,var(--border-2));background:color-mix(in srgb,var(--amber) 8%,transparent);color:color-mix(in srgb,var(--amber) 85%,var(--text));font-family:'DM Mono',monospace;font-size:.74rem;border-radius:16px;letter-spacing:.04em}
    .session-card,.summary{display:grid;gap:1rem}
    .session-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}
    .session-actions .btn{width:100%}
    .session-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem;margin-bottom:.2rem}
    .summary{grid-template-columns:repeat(3,minmax(0,1fr));gap:.9rem}
    .metric-inline,.summary-item{display:grid;gap:.25rem;padding:1rem 1rem .95rem;border:1px solid color-mix(in srgb,var(--border) 88%, transparent);border-radius:18px;background:linear-gradient(180deg,color-mix(in srgb,var(--bg-soft) 76%, transparent) 0%,color-mix(in srgb,var(--bg-panel) 88%, transparent) 100%)}
    .metric-inline{min-height:5.7rem;padding:1.15rem 1.1rem 1.05rem}
    .metric-inline__label{color:var(--text-dim);font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}
    .metric-inline strong{font-weight:600;color:var(--text);font-family:'Crimson Pro',serif;font-size:1.48rem;line-height:1.02;max-width:12ch}
    .summary-item span{color:var(--text-dim);font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}
    .summary-item strong{font-weight:600;font-family:'Crimson Pro',serif;font-size:1.35rem;line-height:.95}
    .summary-item--sales strong{color:var(--success)}
    .summary-item--withdrawals strong{color:var(--danger)}
    .summary-item--cancellations strong{color:var(--danger)}
    .summary-item--balance strong{color:var(--text)}
    .history-header-actions{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap}
    .history-header-actions>span{display:inline-flex;align-items:center;min-height:2.2rem;padding:0 .8rem;border:1px solid color-mix(in srgb,var(--amber) 18%, var(--border));border-radius:999px;color:var(--amber);background:color-mix(in srgb,var(--amber) 8%, transparent);font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}
    .history-filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;align-items:end;margin-bottom:1rem;padding:1rem;border:1px solid color-mix(in srgb,var(--border) 88%, transparent);border-radius:20px;background:color-mix(in srgb,var(--bg-soft) 58%, transparent)}
    .history-group{display:grid;gap:1rem}
    .history-session{border:1px solid color-mix(in srgb,var(--border) 90%, transparent);border-radius:22px;background:linear-gradient(180deg,color-mix(in srgb,var(--bg-soft) 70%, transparent) 0%,color-mix(in srgb,var(--bg-panel) 88%, transparent) 100%);box-shadow:inset 0 1px 0 color-mix(in srgb,white 6%, transparent)}
    .history-session--open{border-color:color-mix(in srgb,var(--success) 24%, var(--border));background:linear-gradient(180deg,color-mix(in srgb,var(--success) 5%, var(--bg-soft)) 0%,color-mix(in srgb,var(--bg-panel) 88%, transparent) 100%)}
    .history-session--closed{border-color:color-mix(in srgb,var(--danger) 20%, var(--border));background:linear-gradient(180deg,color-mix(in srgb,var(--danger) 4%, var(--bg-soft)) 0%,color-mix(in srgb,var(--bg-panel) 88%, transparent) 100%)}
    .history-session__summary{width:100%;display:grid;gap:1rem;background:transparent;border:none;padding:1rem 1rem .95rem;text-align:left;cursor:pointer}
    .history-session__headline{display:flex;justify-content:space-between;gap:1rem;align-items:center;color:var(--text);font-family:'DM Mono',monospace;font-size:.8rem}
    .history-session__headline span{display:inline-flex;align-items:center;min-height:2rem;padding:0 .7rem;border-radius:999px;border:1px solid color-mix(in srgb,var(--success) 24%, var(--border));background:color-mix(in srgb,var(--success) 8%, transparent);color:var(--success);text-transform:uppercase;letter-spacing:.12em;font-size:.68rem}
    .history-session__status--closed{color:var(--danger)!important}
    .history-session__status--closed{border-color:color-mix(in srgb,var(--danger) 24%, var(--border))!important;background:color-mix(in srgb,var(--danger) 8%, transparent)!important}
    .history-session__metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem;color:var(--text-soft);font-family:'DM Mono',monospace;font-size:.74rem}
    .history-session__metrics span{padding:.75rem .8rem;border:1px solid color-mix(in srgb,var(--border) 82%, transparent);border-radius:14px;background:color-mix(in srgb,var(--bg) 42%, transparent)}
    .session-breakdown{padding:.45rem 0 .55rem;border-bottom:1px solid var(--border);margin-bottom:.75rem;color:var(--text-soft);font-family:'DM Mono',monospace;font-size:.72rem;display:flex;flex-wrap:wrap;align-items:center;gap:.15rem}
    .transfer-bank-breakdown{padding:.4rem 0 .5rem;margin-bottom:.5rem;color:var(--text-soft);font-family:'DM Mono',monospace;font-size:.7rem;display:flex;flex-wrap:wrap;align-items:center;gap:.15rem;border-left:2px solid color-mix(in srgb,var(--amber) 40%,transparent);padding-left:.6rem}
    .transfer-bank-breakdown__title{color:var(--text-dim);text-transform:uppercase;letter-spacing:.1em;font-size:.63rem;width:100%;margin-bottom:.2rem}
    .transfer-bank-breakdown__note{font-style:italic;text-transform:none;letter-spacing:0;opacity:.7}
    .session-breakdown__label{color:var(--text-dim);text-transform:uppercase;letter-spacing:.1em;font-size:.65rem}
    .session-breakdown__amount{color:var(--success);font-weight:600;margin-left:.3rem}
    .session-breakdown__sep{color:var(--border-2);margin:0 .2rem}
    .history-session__body{padding:0 1rem 1rem}
    .history-session__toolbar{display:flex;justify-content:space-between;gap:1rem;align-items:center;color:var(--text);font-family:'DM Mono',monospace;font-size:.74rem;margin-bottom:.85rem;padding:0 0 .85rem;border-bottom:1px solid color-mix(in srgb,var(--border) 78%, transparent)}
    .history-table{overflow:auto;border:1px solid color-mix(in srgb,var(--border) 88%, transparent);border-radius:18px;background:color-mix(in srgb,var(--bg-soft) 72%, transparent)}
    .history-table table{width:100%;border-collapse:collapse;min-width:980px}
    .history-table th,.history-table td{padding:.8rem .9rem;border-bottom:1px solid var(--border);text-align:left;color:var(--text);font-family:'DM Mono',monospace;font-size:.74rem;vertical-align:top}
    .history-table th{color:var(--text-dim);font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;background:color-mix(in srgb,var(--bg-panel) 88%, transparent)}
    .empty{color:var(--text-soft);font-family:'DM Mono',monospace;font-size:.78rem}
    .badge{display:inline-flex;align-items:center;justify-content:flex-start;width:auto;inline-size:max-content;max-inline-size:100%;padding:.18rem .55rem;border-radius:999px;font-family:'DM Mono',monospace;font-size:.65rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
    .badge--in{background:color-mix(in srgb,var(--success) 16%, transparent);color:var(--success);border:1px solid color-mix(in srgb,var(--success) 35%, transparent)}
    .badge--out{background:color-mix(in srgb,var(--danger) 16%, transparent);color:var(--danger);border:1px solid color-mix(in srgb,var(--danger) 35%, transparent)}
    .badge--type{background:color-mix(in srgb,var(--amber) 12%, transparent);color:var(--amber);border:1px solid color-mix(in srgb,var(--amber) 30%, transparent)}
    .badge--type[data-type="CashWithdrawal"]{background:color-mix(in srgb,var(--danger) 12%, transparent);color:var(--danger);border:1px solid color-mix(in srgb,var(--danger) 30%, transparent)}
    .badge--type[data-type="OpeningBalance"]{background:color-mix(in srgb,var(--success) 12%, transparent);color:var(--success);border:1px solid color-mix(in srgb,var(--success) 30%, transparent)}
    .badge--type[data-type="ClosingBalance"]{background:color-mix(in srgb,var(--text-dim) 12%, transparent);color:var(--text-dim);border:1px solid color-mix(in srgb,var(--text-dim) 28%, transparent)}
    .badge--type[data-type="CashTransferOut"]{background:color-mix(in srgb,#6366f1 12%, transparent);color:#6366f1;border:1px solid color-mix(in srgb,#6366f1 30%, transparent)}
    .badge--type[data-type="CashTransferIn"]{background:color-mix(in srgb,#06b6d4 12%, transparent);color:#06b6d4;border:1px solid color-mix(in srgb,#06b6d4 30%, transparent)}
    .badge--type[data-type="SaleCancellation"]{background:color-mix(in srgb,var(--danger) 12%, transparent);color:var(--danger);border:1px solid color-mix(in srgb,var(--danger) 30%, transparent)}
    .badge--type[data-type="CuentaCorrienteIncome"]{background:color-mix(in srgb,#14b8a6 12%, transparent);color:#14b8a6;border:1px solid color-mix(in srgb,#14b8a6 30%, transparent)}
    .badge--type[data-type="CuentaCorrienteCancellation"]{background:color-mix(in srgb,#f97316 12%, transparent);color:#f97316;border:1px solid color-mix(in srgb,#f97316 30%, transparent)}
    .badge--type[data-type="PurchaseExpense"]{background:color-mix(in srgb,#a855f7 12%, transparent);color:#a855f7;border:1px solid color-mix(in srgb,#a855f7 30%, transparent)}
    .history-table__row--clickable{cursor:pointer}.history-table__row--clickable:hover{background:color-mix(in srgb,#14b8a6 8%, transparent)}.history-table__row--clickable[data-type-purchase]:hover{background:color-mix(in srgb,#a855f7 8%, transparent)}
    .sale-code-ref{font-family:'DM Mono',monospace;font-size:.72rem;color:var(--amber);letter-spacing:.04em}
    .username-ref{font-family:'DM Mono',monospace;font-size:.72rem;color:var(--text-dim);letter-spacing:.04em}
    .modal--cc-popup{max-width:620px;background:
      radial-gradient(circle at top right,color-mix(in srgb,#14b8a6 10%, transparent),transparent 34%),
      linear-gradient(180deg,color-mix(in srgb,var(--bg-panel) 98%, transparent) 0%,color-mix(in srgb,var(--bg) 98%, transparent) 100%)}
    .modal__head--cc-popup{align-items:flex-start;padding-bottom:1rem}
    .cc-popup-head{display:grid;gap:.28rem}
    .cc-popup-head__eyebrow{color:color-mix(in srgb,#14b8a6 72%, var(--text-dim) 28%);font-family:'DM Mono',monospace;font-size:.64rem;letter-spacing:.18em;text-transform:uppercase}
    .modal__body--cc-popup{padding:1.35rem}
    .cc-popup-loading{display:flex;align-items:center;gap:.7rem;padding:.95rem 1rem;border:1px dashed color-mix(in srgb,var(--border) 88%, transparent);border-radius:14px;background:color-mix(in srgb,var(--bg) 72%, transparent)}
    .cc-popup-loading p{margin:0;color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.76rem}
    .cc-popup-loading__dot{width:.7rem;height:.7rem;border-radius:999px;background:color-mix(in srgb,#14b8a6 72%, transparent);box-shadow:0 0 0 6px color-mix(in srgb,#14b8a6 12%, transparent)}
    .cc-popup-body{display:grid;gap:1rem;padding:1.35rem}
    .cc-popup-hero{display:grid;gap:.38rem;padding:1rem 1.05rem;border:1px solid color-mix(in srgb,#14b8a6 18%, var(--border));border-radius:18px;background:
      linear-gradient(180deg,color-mix(in srgb,#14b8a6 8%, transparent),transparent 88%),
      color-mix(in srgb,var(--bg) 74%, transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,white 8%, transparent)}
    .modal--purchase-popup{max-width:640px;background:
      radial-gradient(circle at top right,color-mix(in srgb,#a855f7 10%, transparent),transparent 34%),
      linear-gradient(180deg,color-mix(in srgb,var(--bg-panel) 98%, transparent) 0%,color-mix(in srgb,var(--bg) 98%, transparent) 100%)}
    .modal__head--purchase-popup{align-items:flex-start;padding-bottom:1rem}
    .purchase-popup-head{display:grid;gap:.28rem}
    .purchase-popup-head__eyebrow{color:color-mix(in srgb,#a855f7 72%, var(--text-dim) 28%);font-family:'DM Mono',monospace;font-size:.64rem;letter-spacing:.18em;text-transform:uppercase}
    .modal__body--purchase-popup{padding:1.35rem}
    .purchase-popup-loading{display:flex;align-items:center;gap:.7rem;padding:.95rem 1rem;border:1px dashed color-mix(in srgb,var(--border) 88%, transparent);border-radius:14px;background:color-mix(in srgb,var(--bg) 72%, transparent)}
    .purchase-popup-loading p{margin:0;color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.76rem}
    .purchase-popup-loading__dot{width:.7rem;height:.7rem;border-radius:999px;background:color-mix(in srgb,#a855f7 72%, transparent);box-shadow:0 0 0 6px color-mix(in srgb,#a855f7 12%, transparent)}
    .purchase-popup-body{display:grid;gap:1rem;padding:1.35rem}
    .purchase-popup-hero{display:grid;gap:.38rem;padding:1rem 1.05rem;border:1px solid color-mix(in srgb,#a855f7 18%, var(--border));border-radius:18px;background:
      linear-gradient(180deg,color-mix(in srgb,#a855f7 8%, transparent),transparent 88%),
      color-mix(in srgb,var(--bg) 74%, transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,white 8%, transparent)}
    .purchase-popup-header__row{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}
    .purchase-popup-header__code{font-family:'DM Mono',monospace;font-weight:600;font-size:1rem;color:var(--text)}
    .purchase-popup-header__meta{display:flex;gap:1rem;flex-wrap:wrap;font-family:'DM Mono',monospace;font-size:.76rem;color:var(--text-dim)}
    .purchase-popup-totals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem}
    .purchase-popup-totals__card{display:grid;gap:.24rem;padding:.95rem 1rem;border:1px solid color-mix(in srgb,var(--border) 84%, transparent);border-radius:16px;background:color-mix(in srgb,var(--bg) 76%, transparent)}
    .purchase-popup-totals__card--paid{border-color:color-mix(in srgb,#22c55e 18%, var(--border));background:color-mix(in srgb,#22c55e 6%, transparent)}
    .purchase-popup-totals__card--pending{border-color:color-mix(in srgb,var(--amber) 20%, var(--border));background:color-mix(in srgb,var(--amber) 8%, transparent)}
    .purchase-popup-totals__label{color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.64rem;letter-spacing:.14em;text-transform:uppercase}
    .purchase-popup-totals__card strong{color:var(--text);font-family:'DM Mono',monospace;font-size:1.08rem}
    .purchase-popup-section-title{font-family:'DM Mono',monospace;font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim)}
    .purchase-popup-products__table{display:grid;gap:.3rem;margin-top:.4rem}
    .purchase-popup-products__head,.purchase-popup-products__row{display:grid;grid-template-columns:minmax(0,2fr) 80px 110px 110px;gap:.5rem;padding:.55rem .8rem;font-family:'DM Mono',monospace;font-size:.72rem}
    .purchase-popup-products__head{background:color-mix(in srgb,var(--bg-panel) 88%, transparent);border:1px solid color-mix(in srgb,var(--border) 84%, transparent);border-radius:12px 12px 0 0;color:var(--text-dim);font-size:.65rem;letter-spacing:.1em;text-transform:uppercase}
    .purchase-popup-products__row{border:1px solid color-mix(in srgb,var(--border) 72%, transparent);border-top:none;color:var(--text);background:color-mix(in srgb,var(--bg) 74%, transparent)}
    .purchase-popup-products__row:last-of-type{border-radius:0 0 12px 12px}
    .purchase-popup-products__empty{padding:.9rem 1rem;border:1px dashed color-mix(in srgb,var(--border) 80%, transparent);border-radius:12px;color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.74rem;margin-top:.4rem}
    .purchase-popup-payments{display:grid;gap:.7rem}
    .purchase-popup-payments__empty{padding:.95rem 1rem;border:1px dashed color-mix(in srgb,var(--border) 88%, transparent);border-radius:14px;background:color-mix(in srgb,var(--bg) 72%, transparent);font-family:'DM Mono',monospace;font-size:.76rem;color:var(--text-soft)}
    .purchase-popup-payment{padding:.8rem .9rem;border:1px solid color-mix(in srgb,#a855f7 14%, var(--border));border-radius:14px;background:color-mix(in srgb,var(--bg) 74%, transparent)}
    .purchase-popup-payment__row{display:flex;align-items:flex-start;gap:.85rem}
    .purchase-popup-payment__copy{display:grid;gap:.14rem;flex:1}
    .purchase-popup-payment__date{font-family:'DM Mono',monospace;font-size:.7rem;color:var(--text-dim)}
    .purchase-popup-payment__method{font-family:'DM Mono',monospace;font-size:.8rem;color:var(--text)}
    .purchase-popup-payment__taxes{font-family:'DM Mono',monospace;font-size:.68rem;color:color-mix(in srgb,#a855f7 72%, var(--text-dim) 28%)}
    .purchase-popup-payment__amount{font-family:'DM Mono',monospace;font-weight:600;font-size:.86rem;color:var(--text);white-space:nowrap}
    .modal--cancel-detail-popup{max-width:560px;background:
      radial-gradient(circle at top left,color-mix(in srgb,var(--danger) 10%, transparent),transparent 34%),
      linear-gradient(180deg,color-mix(in srgb,var(--bg-panel) 98%, transparent) 0%,color-mix(in srgb,var(--bg) 98%, transparent) 100%)}
    .modal__head--cancel-detail{align-items:flex-start;padding-bottom:1rem}
    .cancel-detail-head{display:grid;gap:.28rem}
    .cancel-detail-head__eyebrow{color:color-mix(in srgb,var(--danger) 62%, var(--text-dim) 38%);font-family:'DM Mono',monospace;font-size:.64rem;letter-spacing:.18em;text-transform:uppercase}
    .modal__body--cancel-detail{display:grid;gap:1rem}
    .cancel-detail-hero{display:grid;gap:.4rem;padding:1rem 1.05rem;border:1px solid color-mix(in srgb,var(--danger) 20%, var(--border));border-radius:18px;background:
      linear-gradient(180deg,color-mix(in srgb,var(--danger) 8%, transparent),transparent 88%),
      color-mix(in srgb,var(--bg) 72%, transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,white 8%, transparent)}
    .cancel-detail-hero__kicker{color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.64rem;letter-spacing:.16em;text-transform:uppercase}
    .cancel-detail-hero__code{color:var(--danger);font-family:'DM Mono',monospace;font-size:1.04rem;letter-spacing:.06em}
    .cancel-detail-hero__copy{color:var(--text-soft);font-family:'Crimson Pro',serif;font-size:.98rem;line-height:1.45}
    .cancel-detail-meta-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}
    .cancel-detail-meta-card{display:grid;gap:.28rem;padding:.85rem .95rem;border:1px solid color-mix(in srgb,var(--border) 86%, transparent);border-radius:14px;background:color-mix(in srgb,var(--bg) 78%, transparent)}
    .cancel-detail-meta-card__label{color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.64rem;letter-spacing:.14em;text-transform:uppercase}
    .cancel-detail-meta-card strong{color:var(--text);font-family:'DM Mono',monospace;font-size:.84rem;letter-spacing:.03em}
    .cancel-detail-session-id{font-family:'DM Mono',monospace;font-size:.76rem;color:color-mix(in srgb,var(--amber) 58%, var(--text) 42%)}
    .cancel-detail-section-title{font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.16em;color:var(--text-dim);margin:.2rem 0 0}
    .cancel-detail-payments{display:grid;gap:.55rem}
    .cancel-detail-payment{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:.8rem .9rem;border:1px solid color-mix(in srgb,var(--border) 82%, transparent);border-radius:14px;background:color-mix(in srgb,var(--bg) 74%, transparent)}
    .cancel-detail-payment__copy{display:grid;gap:.18rem}
    .cancel-detail-payment__method{color:var(--text);font-family:'DM Mono',monospace;font-size:.8rem}
    .cancel-detail-payment__note{color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.64rem;letter-spacing:.08em;text-transform:uppercase}
    .cancel-detail-payment__amount{color:var(--text);font-family:'DM Mono',monospace;font-size:.88rem}
    .cancel-detail-payments__empty{padding:.95rem 1rem;border:1px dashed color-mix(in srgb,var(--border) 88%, transparent);border-radius:14px;color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.76rem;background:color-mix(in srgb,var(--bg) 72%, transparent)}
    .cancel-detail-total{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.05rem;border:1px solid color-mix(in srgb,var(--danger) 24%, var(--border));border-radius:16px;background:
      linear-gradient(135deg,color-mix(in srgb,var(--danger) 10%, transparent),transparent 70%),
      color-mix(in srgb,var(--bg) 72%, transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,white 8%, transparent)}
    .cancel-detail-total__label{color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase}
    .cancel-detail-total strong{color:var(--danger);font-family:'DM Mono',monospace;font-size:1.05rem}
    .cancel-detail-loading{display:flex;align-items:center;gap:.7rem;padding:.95rem 1rem;border:1px dashed color-mix(in srgb,var(--border) 88%, transparent);border-radius:14px;background:color-mix(in srgb,var(--bg) 72%, transparent)}
    .cancel-detail-loading p{margin:0;color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.76rem}
    .cancel-detail-loading__dot{width:.7rem;height:.7rem;border-radius:999px;background:color-mix(in srgb,var(--danger) 72%, transparent);box-shadow:0 0 0 6px color-mix(in srgb,var(--danger) 12%, transparent)}
    .cc-popup-header__row{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}
    .cc-popup-header__code{font-family:'DM Mono',monospace;font-weight:600;font-size:1rem;color:var(--text)}
    .cc-popup-header__meta{display:flex;gap:1rem;flex-wrap:wrap;font-family:'DM Mono',monospace;font-size:.76rem;color:var(--text-dim)}
    .cc-popup-hero__copy{margin:0;color:var(--text-soft);font-family:'Crimson Pro',serif;font-size:.98rem;line-height:1.45}
    .cc-popup-totals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem}
    .cc-popup-totals__card{display:grid;gap:.24rem;padding:.95rem 1rem;border:1px solid color-mix(in srgb,var(--border) 84%, transparent);border-radius:16px;background:color-mix(in srgb,var(--bg) 76%, transparent)}
    .cc-popup-totals__card--paid{border-color:color-mix(in srgb,#22c55e 18%, var(--border));background:color-mix(in srgb,#22c55e 6%, transparent)}
    .cc-popup-totals__card--pending{border-color:color-mix(in srgb,var(--amber) 20%, var(--border));background:color-mix(in srgb,var(--amber) 8%, transparent)}
    .cc-popup-totals__label{color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.64rem;letter-spacing:.14em;text-transform:uppercase}
    .cc-popup-totals__card strong{color:var(--text);font-family:'DM Mono',monospace;font-size:1.08rem}
    .cc-popup-payments{display:grid;gap:.7rem}
    .cc-popup-payments__head{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem}
    .cc-popup-payments__head div{display:grid;gap:.18rem}
    .cc-popup-payments__head strong{color:var(--text);font-family:'DM Mono',monospace;font-size:.78rem}
    .cc-popup-payments__title{font-family:'DM Mono',monospace;font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim)}
    .cc-popup-payments__empty{padding:.95rem 1rem;border:1px dashed color-mix(in srgb,var(--border) 88%, transparent);border-radius:14px;background:color-mix(in srgb,var(--bg) 72%, transparent);font-family:'DM Mono',monospace;font-size:.76rem;color:var(--text-soft)}
    .cc-popup-payment{padding:.8rem .9rem;border:1px solid color-mix(in srgb,var(--border) 82%, transparent);border-radius:14px;background:color-mix(in srgb,var(--bg) 74%, transparent)}
    .cc-popup-payment--cancelled{opacity:.5;text-decoration:line-through}
    .cc-popup-payment__row{display:flex;align-items:center;gap:.85rem}
    .cc-popup-payment__copy{display:grid;gap:.16rem}
    .cc-popup-payment__date{font-family:'DM Mono',monospace;font-size:.7rem;color:var(--text-dim)}
    .cc-popup-payment__method{font-family:'DM Mono',monospace;font-size:.8rem;color:var(--text)}
    .cc-popup-payment__amount{font-family:'DM Mono',monospace;font-weight:600;font-size:.86rem;margin-left:auto;color:var(--text)}
    .modal--pending-close{max-width:560px}
    .pending-close-copy{display:grid;gap:.9rem;margin-bottom:1rem}
    .pending-close-copy p{margin:0;color:var(--text-soft);font-family:'Crimson Pro',serif;font-size:1rem;line-height:1.5}
    .pending-close-total{display:flex;justify-content:space-between;align-items:center;padding:.8rem .95rem;border:1px solid color-mix(in srgb,var(--danger) 28%, var(--border));background:color-mix(in srgb,var(--danger) 6%, transparent);border-radius:10px}
    .pending-close-total span{color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase}
    .pending-close-total strong{color:var(--danger);font-family:'DM Mono',monospace;font-size:1rem}
    .pending-close-list{display:grid;gap:.7rem;max-height:280px;overflow:auto;padding-right:.2rem}
    .pending-close-sale{padding:.85rem .95rem;border:1px solid var(--border);border-radius:10px;background:color-mix(in srgb,var(--bg) 70%, transparent)}
    .pending-close-sale__row{display:flex;justify-content:space-between;align-items:center;gap:1rem}
    .pending-close-sale__code{color:var(--text);font-family:'DM Mono',monospace;font-size:.82rem}
    .pending-close-sale__amount{color:var(--danger);font-family:'DM Mono',monospace;font-size:.92rem}
    .pending-close-sale__meta{display:flex;justify-content:space-between;gap:1rem;margin-top:.45rem;color:var(--text-soft);font-family:'DM Mono',monospace;font-size:.72rem;flex-wrap:wrap}
    .btn--transfer{background:color-mix(in srgb,#6366f1 8%, transparent);border:1px solid color-mix(in srgb,#6366f1 35%, var(--border-2));color:#6366f1;white-space:nowrap}
    .btn--transfer:hover:not(:disabled){background:color-mix(in srgb,#6366f1 14%, transparent);border-color:color-mix(in srgb,#6366f1 55%, var(--border-2));transform:translateY(-1px)}
    .btn--transfer-confirm{font-size:.72rem;letter-spacing:.12em}
    .modal-backdrop{position:fixed;inset:0;background:color-mix(in srgb,black 58%, transparent);backdrop-filter:blur(6px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem}
    .modal{background:linear-gradient(180deg,color-mix(in srgb,var(--bg-panel) 96%, transparent) 0%,color-mix(in srgb,var(--bg) 98%, transparent) 100%);border:1px solid color-mix(in srgb,var(--amber) 14%, var(--border));border-radius:28px;width:100%;max-width:480px;box-shadow:inset 0 1px 0 color-mix(in srgb,white 10%, transparent),0 24px 64px rgba(0,0,0,.24)}
    .modal__head{display:flex;justify-content:space-between;align-items:center;padding:1.1rem 1.25rem;border-bottom:1px solid var(--border)}
    .modal__title{color:var(--text);font-family:'DM Mono',monospace;font-size:.82rem;letter-spacing:.1em;text-transform:uppercase}
    .modal__close{width:2.3rem;height:2.3rem;background:color-mix(in srgb,var(--bg) 92%, transparent);border:1px solid var(--border);border-radius:12px;color:var(--text-soft);cursor:pointer;font-size:1rem;padding:.2rem .4rem;line-height:1}
    .modal__close:hover{color:var(--text);border-color:color-mix(in srgb,var(--amber) 28%, var(--border))}
    .modal__body{padding:1.35rem}
    .modal__body form{display:grid;gap:1rem}
    .modal__body .field{display:grid;gap:.4rem}
    .modal__body .field span{color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase}
    .modal__body .control{margin:0}
    .modal__actions{display:flex;justify-content:flex-end;gap:.75rem;margin-top:.5rem}
    .close-confirm-row{display:flex;justify-content:space-between;align-items:center;padding:.6rem .85rem;background:color-mix(in srgb,var(--bg) 60%,transparent);border:1px solid var(--border);border-radius:3px}
    .close-confirm-row__label{color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase}
    .close-confirm-row__value{color:var(--text);font-size:1rem}
    .close-confirm-row__value--neg{color:var(--red,#e05252)}
    .close-confirm-row__value--pos{color:var(--green,#52b788)}
    @media (max-width:920px){
      .page{padding:1.2rem .85rem 1.75rem}
      .hero{grid-template-columns:1fr;margin-bottom:1.2rem}
      .hero__copy,.hero-stat,.panel,.modal{border-radius:22px}
      .hero h1{font-size:clamp(1.55rem,6vw,2.1rem)}
      .hero p{font-size:.92rem;line-height:1.55}
      .hero__rail{grid-template-columns:repeat(2,minmax(0,1fr))}
      .panel{padding:1rem .9rem;margin-bottom:1rem}
      .panel__header{margin-bottom:.85rem;padding-bottom:.7rem;font-size:.7rem}
      .panel__header--actions{align-items:stretch}
      .panel__heading p{font-size:.72rem}

      .inline-form{grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}
      .inline-form--drawer{grid-template-columns:minmax(0,1fr)}
      .drawer-create__actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.6rem}
      .inline-form .btn{width:100%}

      .drawer-strip{grid-template-columns:1fr;padding:.85rem;gap:.8rem}
      .drawer-strip__intro{padding-bottom:0}
      .drawer-strip__title{font-size:.76rem}
      .drawer-strip__hint{font-size:.66rem}
      .drawer-list{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(180px,78%);overflow-x:auto;overscroll-behavior-x:contain;padding-bottom:.35rem;scroll-snap-type:x proximity}
      .drawer-chip{min-width:unset;scroll-snap-align:start}

      .session-card{gap:.85rem}
      .session-actions{grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}
      .session-metrics,.summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}
      .metric-inline{display:grid;gap:.18rem;min-height:0;padding:1rem}
      .metric-inline strong{font-size:1.02rem}
      .session-card>.btn--danger{width:100%}
      .session-breakdown,.transfer-bank-breakdown{gap:.35rem;line-height:1.6}
      .session-breakdown__sep{display:none}
      .summary-item--balance{grid-column:1 / -1}

      .history-filters{grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}
      .history-header-actions{display:grid;grid-template-columns:1fr 1fr;gap:.65rem;width:100%}
      .history-header-actions>span{grid-column:1 / -1;justify-content:center}
      .history-header-actions .btn{width:100%}
      .history-session__metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:.6rem;font-size:.7rem}
      .history-session__toolbar,.history-session__headline,.history-header-actions{flex-direction:column;align-items:flex-start}
      .history-session__summary{gap:.75rem;padding:.9rem}
      .history-session__body{padding:0 .85rem .85rem}
      .history-session__toolbar{gap:.65rem}
      .history-session__toolbar .btn{width:100%}
      .history-session__headline span{align-self:flex-start}

      .history-table table{min-width:0}
      .history-table thead{display:none}
      .history-table tbody,.history-table tr,.history-table td{display:block;width:100%}
      .history-table tr{border:1px solid var(--border);border-radius:14px;background:color-mix(in srgb,var(--bg) 86%, transparent);margin:.6rem;padding:.22rem 0}
      .history-table td{display:grid;grid-template-columns:minmax(6.1rem,7rem) minmax(0,1fr);gap:.55rem;align-items:start;border:none;border-bottom:1px dashed color-mix(in srgb,var(--border) 70%, transparent);padding:.7rem .78rem;font-size:.74rem}
      .history-table td:last-child{border-bottom:none}
      .history-table td::before{display:block;margin-bottom:0;color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.61rem;letter-spacing:.1em;text-transform:uppercase;line-height:1.35}
      .history-table td .badge{display:inline-flex;justify-self:start;align-self:start;width:auto;inline-size:max-content;max-inline-size:100%}
      .history-table td:nth-child(1)::before{content:'Movimiento'}
      .history-table td:nth-child(2)::before{content:'Tipo'}
      .history-table td:nth-child(3)::before{content:'Sentido'}
      .history-table td:nth-child(4)::before{content:'Monto'}
      .history-table td:nth-child(5)::before{content:'Medio de pago'}
      .history-table td:nth-child(6)::before{content:'Descripcion'}

      .modal-backdrop{padding:.75rem}
      .modal{max-width:none;max-height:min(100dvh - 1.5rem, 48rem);display:flex;flex-direction:column;overflow:hidden}
      .modal__head{flex-shrink:0;padding:1rem 1rem .85rem}
      .modal__body{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:1rem}
      .modal__actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem}
      .modal__actions .btn{width:100%}
      .cancel-detail-meta-grid{grid-template-columns:1fr}
    }

    @media (max-width:560px){
      .page{padding:1rem .72rem 1.25rem}
      .panel{padding:.9rem .8rem}
      .hero__rail{grid-template-columns:1fr}
      .panel__header{gap:.7rem}
      .panel__heading p{line-height:1.45}
      .inline-form,.history-filters,.session-metrics,.summary,.history-session__metrics,.drawer-create__actions,.modal__actions,.history-header-actions,.session-actions{grid-template-columns:1fr}
      .inline-form{gap:.65rem}
      .inline-form .control,.inline-form .btn{min-height:3rem}
      .drawer-list{grid-auto-columns:minmax(220px,88%)}
      .metric-inline,.summary-item{padding:.9rem .92rem;border-radius:16px}
      .metric-inline strong,.summary-item strong{font-size:1.18rem}
      .history-filters{padding:.85rem;gap:.65rem}
      .history-session{border-radius:18px}
      .history-session__headline strong{font-size:.74rem}
      .history-session__headline span{font-size:.62rem}
      .history-session__summary{padding:.85rem}
      .history-session__metrics span{padding:.68rem .72rem}
      .history-header-actions>span,.history-header-actions .btn{width:100%}
      .session-breakdown,.transfer-bank-breakdown{font-size:.68rem}
      .history-table td{grid-template-columns:1fr;gap:.28rem}
      .history-table td::before{margin-bottom:.1rem}
      .history-table td .badge{display:inline-flex;justify-self:start;align-self:start;width:auto;inline-size:max-content;max-inline-size:100%}
      .cc-popup-body,.modal__body--cc-popup{padding:1rem}
      .cc-popup-header__row,.cc-popup-header__meta,.cc-popup-payment__row{display:grid;gap:.35rem}
      .cc-popup-totals{grid-template-columns:1fr}
      .cc-popup-payment__amount{margin-left:0}
      .purchase-popup-body,.modal__body--purchase-popup{padding:1rem}
      .purchase-popup-header__row,.purchase-popup-header__meta{display:grid;gap:.35rem}
      .purchase-popup-totals{grid-template-columns:1fr}
      .purchase-popup-products__head,.purchase-popup-products__row{grid-template-columns:minmax(0,1fr) 70px;font-size:.7rem}
      .purchase-popup-products__head span:nth-child(3),.purchase-popup-products__head span:nth-child(4),.purchase-popup-products__row span:nth-child(3),.purchase-popup-products__row span:nth-child(4){display:none}
      .pending-close-sale__row,.pending-close-sale__meta,.pending-close-total{display:grid;gap:.35rem}
      .cancel-detail-hero,.cancel-detail-payment,.cancel-detail-total,.cancel-detail-loading{padding:.9rem}
      .cancel-detail-payment{align-items:flex-start;flex-direction:column}
      .cancel-detail-payment__amount{font-size:.94rem}
    }
  `]
})
export class CashComponent implements OnInit {
    readonly permissionCodes = PermissionCodes;
    drawerForm: FormGroup;
    openForm: FormGroup;
    withdrawForm: FormGroup;
    closeForm: FormGroup;
    transferForm: FormGroup;
    showWithdrawModal = false;
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
    cancelDetailPopupRow: { occurredAt: string; typeName: string; directionName: string; amount: number; paymentMethodLabel: string; description: string | null | undefined; referenceId: string | null; saleCode: string | null; username: string | null; originalCashSessionId?: string | null } | null = null;
    purchasePopupId: string | null = null;
    purchasePopupData: PurchaseDetailResponse | null = null;
    purchasePopupLoading = false;
    pendingCloseSales: SaleResponse[] = [];
    historyFrom = '';
    historyTo = '';
    showCreateDrawer = false;
    loadingSession = false;
    loadingHistory = false;
    onboardingStatus: OnboardingStatusResponse | null = null;

    constructor(
        private fb: FormBuilder,
        private branchService: BranchService,
        private cashService: CashService,
        private saleService: SaleService,
        private bankService: BankService,
        private purchaseService: PurchaseService,
        private toast: ToastService,
        private onboardingService: OnboardingService,
        private router: Router,
        public auth: AuthService
    ) {
        this.drawerForm = this.fb.group({ name: ['', Validators.required] });
        this.openForm = this.fb.group({ openingAmount: [0, [Validators.required, Validators.min(0)]], notes: [''] });
        this.withdrawForm = this.fb.group({ amount: [0, [Validators.required, Validators.min(0.01)]], description: ['', Validators.required] });
        this.closeForm = this.fb.group({ actualClosingAmount: [0, [Validators.required, Validators.min(0)]], notes: [''] });
        this.transferForm = this.fb.group({ targetCashDrawerId: ['', Validators.required], amount: [0, [Validators.required, Validators.min(0.01)]], description: ['', Validators.required] });
    }

    ngOnInit(): void {
        this.refreshOnboarding();
        this.loadBranches();
        this.bankService.listBanks().subscribe({
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

    openSession(): void {
        if (!this.selectedDrawerId || this.openForm.invalid) {
            this.openForm.markAllAsTouched();
            return;
        }

        const { openingAmount, notes } = this.openForm.getRawValue();
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

                this.checkingPendingCloseSales = false;

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

        const { targetCashDrawerId, amount, description } = this.transferForm.getRawValue();
        this.cashService.transfer(this.selectedDrawerId, targetCashDrawerId, Number(amount), description).subscribe({
            next: () => {
                this.showTransferModal = false;
                this.transferForm.reset({ targetCashDrawerId: '', amount: 0, description: '' });
                this.loadCurrentSession();
                this.loadHistory();
                this.toast.success('Transferencia registrada');
            },
            error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo registrar la transferencia')
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
        this.downloadExcel(`cash-session-${session.openedAt.slice(0, 10)}.xlsx`, headers, body, breakdown, transferBreakdown, cardBreakdown);
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
            : new Date().toISOString().slice(0, 10);

        const allSessions = this.historySessions.map(item => item.session);
        const allBreakdown = allSessions.flatMap(s => this.computePaymentBreakdown(s));
        const allTransferBreakdown = allSessions.flatMap(s => this.computeTransferBankBreakdown(s));
        const allCardBreakdown = allSessions.flatMap(s => this.computeCardBankBreakdown(s));
        this.downloadExcel(`cash-history-${suffix}.xlsx`, headers, body, allBreakdown, allTransferBreakdown, allCardBreakdown);
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
            : new Date().toISOString().slice(0, 10);

        const overrides = new Map<string, number>(this.historySessions.map(item => [item.session.id, item.expectedClosingAmount]));
        this.exportSessionsPdf(`cash-history-${suffix}.pdf`, 'Historial de caja', this.historySessions.map(item => item.session), overrides);
    }

    private exportSessionsPdf(fileName: string, title: string, sessions: CashSessionResponse[], expectedOverrides?: Map<string, number>): void {
        const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'landscape' });
        const margin = 14;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const maxY = pageHeight - 14;
        let y = 16;

        const movementColumns = {
            movement: { x: margin + 2, width: 25 },
            type: { x: margin + 30, width: 18 },
            saleCode: { x: margin + 51, width: 22 },
            direction: { x: margin + 76, width: 13 },
            amount: { x: margin + 92, width: 18 },
            payment: { x: margin + 113, width: 50 },
            description: { x: margin + 166, width: 103 }
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
            doc.text('Caja / Sesiones / Movimientos', margin, y + 1.5);
            y += 4.5;

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
            doc.setFillColor(235, 232, 225);
            doc.setDrawColor(206, 202, 192);
            doc.roundedRect(margin, y, pageWidth - margin * 2, 7, 1.5, 1.5, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.7);
            doc.setTextColor(62, 62, 62);
            doc.text('Movimiento', movementColumns.movement.x, y + 4.7);
            doc.text('Tipo', movementColumns.type.x, y + 4.7);
            doc.text('Cod. venta', movementColumns.saleCode.x, y + 4.7);
            doc.text('Sentido', movementColumns.direction.x, y + 4.7);
            doc.text('Monto', movementColumns.amount.x, y + 4.7);
            doc.text('Pago', movementColumns.payment.x, y + 4.7);
            doc.text('Descripcion', movementColumns.description.x, y + 4.7);
            y += 7;
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
            doc.text(`Sesion ${session.id}`, margin, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.2);
            doc.setTextColor(92, 92, 92);
            doc.text(session.statusName, margin + 42, y);
            y += 4.4;

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
                const typeLines = doc.splitTextToSize(typeLabel, movementColumns.type.width) as string[];
                const saleCodeLines = doc.splitTextToSize(saleCode, movementColumns.saleCode.width) as string[];
                const directionLines = doc.splitTextToSize(directionLabel, movementColumns.direction.width) as string[];
                const paymentMethodLines = doc.splitTextToSize(row.paymentMethodLabel, movementColumns.payment.width) as string[];
                const descriptionLines = doc.splitTextToSize(description, movementColumns.description.width) as string[];
                const clippedDescription = descriptionLines.slice(0, 2);
                const rowHeight = Math.max(
                    8.2,
                    clippedDescription.length * 3.4 + 2.4,
                    paymentMethodLines.length * 3.4 + 2.4,
                    typeLines.length * 3.4 + 2.4,
                    saleCodeLines.length * 3.4 + 2.4,
                    directionLines.length * 3.4 + 2.4
                );

                if (y + rowHeight > maxY) {
                    doc.addPage();
                    y = 16;
                    drawDocumentHeader(true);
                    drawMovementHeader();
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
                doc.text(this.formatDate(row.occurredAt), movementColumns.movement.x, y + 4.8);
                doc.text(typeLines, movementColumns.type.x, y + 4.8);
                doc.text(saleCodeLines, movementColumns.saleCode.x, y + 4.8);
                doc.text(directionLines, movementColumns.direction.x, y + 4.8);
                doc.text(this.formatCurrency(row.amount), movementColumns.amount.x + movementColumns.amount.width, y + 4.8, { align: 'right' });
                doc.text(paymentMethodLines, movementColumns.payment.x, y + 4.8);
                doc.text(clippedDescription, movementColumns.description.x, y + 4.8);

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
                    this.cashService.getLastClosedSession(this.selectedDrawerId).subscribe({
                        next: ({ suggestedOpeningAmount }) => {
                            if (suggestedOpeningAmount > 0) {
                                this.openForm.patchValue({ openingAmount: suggestedOpeningAmount });
                            }
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
                    const salesIncome = this.sumMovementsByType(session.movements, 'SaleIncome')
                        + this.sumMovementsByType(session.movements, 'CuentaCorrienteIncome')
                        - this.sumMovementsByType(session.movements, 'SaleCancellation');
                    const withdrawals = this.sumMovementsByType(session.movements, 'CashWithdrawal');
                    return {
                        session,
                        expanded: false,
                        salesIncome,
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
        const salesIncome = session.movements
            .filter(movement => movement.typeName === 'SaleIncome' || movement.typeName === 'CuentaCorrienteIncome')
            .reduce((total, movement) => total + movement.amount, 0);

        const withdrawals = session.movements
            .filter(movement => movement.typeName === 'CashWithdrawal')
            .reduce((total, movement) => total + movement.amount, 0);

        const salesCancellations = session.movements
            .filter(movement => movement.typeName === 'SaleCancellation')
            .reduce((total, movement) => total + movement.amount, 0);

        return {
            id: session.id,
            openingAmount: session.openingAmount,
            salesIncome,
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
        };
        return map[typeName] ?? typeName;
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
        if (movement.typeName === 'CuentaCorrienteCancellation') {
            return 'Cuenta Corriente';
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

    getDisplayRows(session: CashSessionResponse): { occurredAt: string; typeName: string; directionName: string; amount: number; paymentMethodLabel: string; description: string | null | undefined; referenceId: string | null; saleCode: string | null; username: string | null; originalCashSessionId?: string | null }[] {
        const seenSaleIncomeIds = new Set<string>();
        const rows: { occurredAt: string; typeName: string; directionName: string; amount: number; paymentMethodLabel: string; description: string | null | undefined; referenceId: string | null; saleCode: string | null; username: string | null; originalCashSessionId?: string | null }[] = [];

        for (const movement of session.movements) {
            const refId = movement.referenceId ? String(movement.referenceId) : null;
            const saleCode = movement.saleCode ?? null;
            const username = movement.createdByUsername ?? null;
            const isSaleIncome = (movement.typeName === 'SaleIncome' || movement.typeName === 'TransferIncome' || movement.typeName === 'CardIncome') && movement.referenceId;

            if (isSaleIncome) {
                const saleRefId = String(movement.referenceId);
                if (seenSaleIncomeIds.has(saleRefId)) continue;
                seenSaleIncomeIds.add(saleRefId);

                const sale = this.salesBySaleId.get(saleRefId);
                const activePayments = (sale?.payments ?? []).filter(p => Number(p.amount) > 0);
                const activeTradeIns = (sale?.tradeIns ?? []).filter(t => Number(t.amount) > 0);
                if (activePayments.length > 0 || activeTradeIns.length > 0) {
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
                        ...activeTradeIns.map(t => `Canje: $${Number(t.amount).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`)
                    ];
                    rows.push({ occurredAt: movement.occurredAt, typeName: 'SaleIncome', directionName: 'In', amount: totalAmount, paymentMethodLabel: parts.join(' | '), description: movement.description, referenceId: refId, saleCode, username });
                    continue;
                }
                rows.push({ occurredAt: movement.occurredAt, typeName: 'SaleIncome', directionName: 'In', amount: movement.amount, paymentMethodLabel: this.movementPaymentMethod(movement), description: movement.description, referenceId: refId, saleCode, username });
                continue;
            }

            const effectiveDirection = movement.typeName === 'PurchaseExpense' ? 'Out' : movement.directionName;
            const effectiveDescription = movement.typeName === 'PurchaseExpense' ? 'Compra proveedor' : movement.description;
            rows.push({ occurredAt: movement.occurredAt, typeName: movement.typeName, directionName: effectiveDirection, amount: movement.amount, paymentMethodLabel: this.movementPaymentMethod(movement), description: effectiveDescription, referenceId: refId, saleCode, username, originalCashSessionId: movement.originalCashSessionId ?? null });
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
        cardBreakdown?: Array<{ bankName: string; amount: number }>
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

            const breakdownSheet = XLSX.utils.json_to_sheet(breakdownRows, { header: breakdownHeaders });
            XLSX.utils.book_append_sheet(workbook, breakdownSheet, 'Medios de Pago');
        }

        XLSX.writeFile(workbook, fileName, { compression: true });
    }

    private formatCurrency(value: number): string {
        return `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
            .filter(item => Number(item.amount) > 0)
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
        }
        return Array.from(totals.entries())
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

    openCancelDetailPopup(row: { occurredAt: string; typeName: string; directionName: string; amount: number; paymentMethodLabel: string; description: string | null | undefined; referenceId: string | null; saleCode: string | null; username: string | null; originalCashSessionId?: string | null }): void {
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


