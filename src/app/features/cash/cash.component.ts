import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { BranchService } from '../../core/services/branch.service';
import { CashService } from '../../core/services/cash.service';
import { BranchResponse } from '../../core/models/branch.models';
import { CashDrawerResponse, CashSessionMovementResponse, CashSessionResponse, CashSessionSummaryResponse } from '../../core/models/cash.models';
import { ToastService } from '../../shared/services/toast.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { OnboardingStatusResponse } from '../../core/models/onboarding.models';
import { OnboardingBannerComponent } from '../../shared/components/onboarding-banner/onboarding-banner.component';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { AuthService } from '../../core/services/auth.service';
import { PermissionCodes } from '../../core/models/permission.models';

type CashSessionView = {
    session: CashSessionResponse;
    expanded: boolean;
    salesIncome: number;
    withdrawals: number;
};

@Component({
    selector: 'app-cash',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, NavbarComponent, OnboardingBannerComponent],
    template: `
    <app-navbar></app-navbar>
    <div class="page" [class.page--guided-lock]="isOnboardingFocusLocked">
      <header class="hero">
        <div class="eyebrow">_ CAJA</div>
        <h1>Operacion de caja</h1>
        <p>Selecciona una sucursal, administra sus cajas y opera aperturas, cierres e historial.</p>
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

      <section class="panel">
        <div class="panel__header"><span>Configurar caja</span></div>
        <div class="grid">
          <label class="field">
            <span>Sucursal</span>
            <select class="control" [class.control--placeholder]="!selectedBranchId" [ngModel]="selectedBranchId" (ngModelChange)="selectBranch($event)" [ngModelOptions]="{ standalone: true }">
              <option value="" disabled hidden>Selecciona sucursal</option>
              <option *ngFor="let branch of branches" [value]="branch.id">{{ branch.name }}</option>
            </select>
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

        <div class="drawer-strip" *ngIf="drawers.length > 0" [class.drawer-strip--attention]="!selectedDrawerId">
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

      <section class="panel" *ngIf="selectedDrawerId">
        <div class="panel__header"><span>Sesion actual</span></div>

        <div class="empty" *ngIf="loadingSession">Cargando sesion...</div>

        <div *ngIf="!loadingSession && !currentSession">
            <form *ngIf="auth.hasPermission(permissionCodes.cashOpen)" class="inline-form" [formGroup]="openForm" (ngSubmit)="openSession()">
              <input class="control" type="number" min="0" step="0.01" placeholder="Monto inicial" formControlName="openingAmount" />
              <input class="control" type="text" placeholder="Notas" formControlName="notes" />
            <button class="btn btn--primary" type="submit">{{ showInitialCashOpenOnboarding ? 'Abrir caja inicial' : 'Abrir caja' }}</button>
            </form>
          </div>

        <div *ngIf="currentSession" class="session-card">
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
              <strong>&#36;{{ currentSession.expectedClosingAmount | number: '1.2-2' }}</strong>
            </div>
          </div>

          <form *ngIf="auth.hasPermission(permissionCodes.cashWithdraw)" class="inline-form" [formGroup]="withdrawForm" (ngSubmit)="withdraw()">
            <input class="control" type="number" min="0.01" step="0.01" placeholder="Extraccion" formControlName="amount" />
            <input class="control" type="text" placeholder="Motivo" formControlName="description" />
            <button class="btn btn--ghost" type="submit">Registrar extraccion</button>
          </form>

          <form *ngIf="auth.hasPermission(permissionCodes.cashClose)" class="inline-form" [formGroup]="closeForm" (ngSubmit)="closeSession()">
            <input class="control" type="number" min="0" step="0.01" placeholder="Conteo final" formControlName="actualClosingAmount" />
            <input class="control" type="text" placeholder="Notas" formControlName="notes" />
            <button class="btn btn--danger" type="submit">Cerrar caja</button>
          </form>

          <div class="summary" *ngIf="currentSummary">
            <div class="summary-item summary-item--sales">
              <span>Ventas</span>
              <strong>&#36;{{ currentSummary.salesIncome | number: '1.2-2' }}</strong>
            </div>
            <div class="summary-item summary-item--withdrawals">
              <span>Extracciones</span>
              <strong>&#36;{{ currentSummary.withdrawals | number: '1.2-2' }}</strong>
            </div>
            <div class="summary-item summary-item--balance">
              <span>Diferencia</span>
              <strong>&#36;{{ currentSummary.difference | number: '1.2-2' }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="panel" *ngIf="selectedDrawerId">
        <div class="panel__header panel__header--actions">
          <span>Historial de caja</span>
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
          <article class="history-session" *ngFor="let item of historySessions">
            <button type="button" class="history-session__summary" (click)="toggleSession(item.session.id)">
              <div class="history-session__headline">
                <strong>{{ item.session.openedAt | date: 'short' }}</strong>
                <span [class.history-session__status--closed]="isClosedSession(item.session.statusName)">{{ item.session.statusName }}</span>
              </div>
              <div class="history-session__metrics">
                <span>Inicial: &#36;{{ item.session.openingAmount | number: '1.2-2' }}</span>
                <span>Ventas: &#36;{{ item.salesIncome | number: '1.2-2' }}</span>
                <span>Extracciones: &#36;{{ item.withdrawals | number: '1.2-2' }}</span>
                <span>Esperado: &#36;{{ item.session.expectedClosingAmount | number: '1.2-2' }}</span>
              </div>
            </button>

            <div class="history-session__body" *ngIf="item.expanded">
              <div class="history-session__toolbar">
                <span>Cierre real: {{ item.session.actualClosingAmount == null ? '-' : ('$' + (item.session.actualClosingAmount | number: '1.2-2')) }}</span>
                <span>Diferencia: &#36;{{ item.session.difference | number: '1.2-2' }}</span>
                <button *ngIf="auth.hasPermission(permissionCodes.cashHistoryExport)" class="btn btn--ghost btn--export" type="button" (click)="exportSession(item.session)">Exportar sesion XLSX</button>
                <button *ngIf="auth.hasPermission(permissionCodes.cashHistoryExport)" class="btn btn--ghost btn--pdf" type="button" (click)="exportSessionPdf(item.session)">Exportar sesion PDF</button>
              </div>

              <div class="history-table">
                <table>
                  <thead>
                    <tr>
                      <th>Movimiento</th>
                      <th>Tipo</th>
                      <th>Sentido</th>
                      <th>Monto</th>
                      <th>Descripcion</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let movement of item.session.movements">
                      <td>{{ movement.occurredAt | date: 'short' }}</td>
                      <td>{{ movement.typeName }}</td>
                      <td>{{ movement.directionName }}</td>
                      <td>&#36;{{ movement.amount | number: '1.2-2' }}</td>
                      <td>{{ movement.description || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  `,
    styles: [`
    .page{min-height:calc(100vh - 64px);background:linear-gradient(180deg,var(--bg) 0%,var(--bg-elevated) 100%);padding:3rem 2rem;max-width:1120px;margin:0 auto}
    .page--guided-lock .panel{opacity:.34;pointer-events:none;filter:saturate(.7)}
    .hero{margin-bottom:2rem}.hero h1{margin:0;color:var(--text);font-family:'DM Mono',monospace;font-size:clamp(2rem,4vw,2.8rem)}.hero p{margin:.75rem 0 0;color:var(--text-soft);font-family:'Crimson Pro',serif;font-size:1rem}.eyebrow{color:var(--amber);margin-bottom:.6rem;font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.16em;text-transform:uppercase}
    .panel{background:color-mix(in srgb,var(--bg-panel) 94%, transparent);border:1px solid var(--border);border-radius:4px;padding:1.35rem;margin-bottom:1.2rem}
    .panel__header{display:flex;justify-content:space-between;align-items:center;color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;margin-bottom:1rem;padding-bottom:.85rem;border-bottom:1px solid var(--border)}
    .panel__header--actions{gap:1rem}
    .grid{display:grid;gap:1rem}
    .field span{display:block;margin-bottom:.45rem;color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase}
    .inline-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;align-items:end}.inline-form--drawer{grid-template-columns:minmax(0,1fr) auto}
    .drawer-create{display:grid;gap:.85rem;align-content:start}
    .drawer-create__actions{display:flex;gap:.75rem}
    .control{width:100%;box-sizing:border-box;border:1px solid var(--border-2);background:var(--bg);color:var(--text);padding:.8rem .9rem;font-family:'DM Mono',monospace;font-size:.84rem;border-radius:2px;outline:none}
    .control--placeholder{color:var(--text-soft)}
    .btn{position:relative;overflow:hidden;border-radius:2px;padding:.8rem 1rem;font-family:'DM Mono',monospace;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:transform .15s ease,border-color .2s ease,background .2s ease,color .2s ease,box-shadow .2s ease}.btn--primary{border:none;background:var(--amber);color:var(--bg)}.btn--ghost,.btn--danger{background:transparent;border:1px solid var(--border-2);color:var(--text-dim)}.btn--danger{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 35%, var(--border-2))}
    .btn:hover:not(:disabled){transform:translateY(-1px)}
    .btn--primary:hover:not(:disabled){background:color-mix(in srgb,var(--amber) 88%, white 12%);box-shadow:0 8px 16px rgba(0,0,0,.08)}
    .btn--ghost:hover:not(:disabled){border-color:color-mix(in srgb,var(--amber) 28%, var(--border-2));color:var(--text);background:color-mix(in srgb,var(--amber) 6%, transparent)}
    .btn--danger:hover:not(:disabled){border-color:color-mix(in srgb,var(--danger) 45%, var(--border-2));background:color-mix(in srgb,var(--danger) 8%, transparent)}
    .btn--export{border-color:color-mix(in srgb,var(--success) 26%, var(--border-2));color:var(--success);background:color-mix(in srgb,var(--success) 6%, transparent)}
    .btn--export::before{content:'X';display:inline-block;margin-right:.45rem;padding:.08rem .22rem;border:1px solid currentColor;border-radius:2px;font-size:.62rem;line-height:1;font-weight:700}
    .btn--export:hover:not(:disabled){border-color:color-mix(in srgb,var(--success) 48%, var(--border-2));background:color-mix(in srgb,var(--success) 10%, transparent);color:var(--success)}
    .btn--pdf{border-color:color-mix(in srgb,var(--danger) 30%, var(--border-2));color:var(--danger);background:color-mix(in srgb,var(--danger) 6%, transparent)}
    .btn--pdf::before{content:'PDF';display:inline-block;margin-right:.45rem;padding:.08rem .22rem;border:1px solid currentColor;border-radius:2px;font-size:.56rem;line-height:1;font-weight:700;letter-spacing:.06em}
    .btn--pdf:hover:not(:disabled){border-color:color-mix(in srgb,var(--danger) 45%, var(--border-2));background:color-mix(in srgb,var(--danger) 10%, transparent);color:var(--danger)}
    .session-card .btn--ghost{border-color:color-mix(in srgb,var(--amber) 26%, var(--border-2));color:var(--amber);background:color-mix(in srgb,var(--amber) 8%, transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--amber) 10%, transparent)}
    .session-card .btn--ghost:hover:not(:disabled){background:color-mix(in srgb,var(--amber) 14%, transparent);border-color:color-mix(in srgb,var(--amber) 42%, var(--border-2))}
    .session-card .btn--danger{border-color:color-mix(in srgb,var(--danger) 50%, var(--border-2));background:color-mix(in srgb,var(--danger) 8%, transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--danger) 12%, transparent)}
    .session-card .btn--danger:hover:not(:disabled){background:color-mix(in srgb,var(--danger) 14%, transparent);border-color:color-mix(in srgb,var(--danger) 68%, var(--border-2))}
    .btn:disabled{cursor:not-allowed;opacity:.5;filter:saturate(.65)}
    .btn:disabled::after{content:'';position:absolute;left:10%;right:10%;top:50%;height:1px;background:currentColor;opacity:.65;transform:rotate(-8deg);pointer-events:none}
    .drawer-strip{display:grid;grid-template-columns:minmax(220px,280px) 1fr;gap:1rem;align-items:start;margin-top:1rem;padding:1rem 1rem 0;border:1px solid color-mix(in srgb,var(--border) 78%, transparent);background:color-mix(in srgb,var(--bg-soft) 68%, transparent);border-radius:4px}
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
    .session-card,.summary{display:grid;gap:1rem}.session-metrics,.summary{grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--border);background:var(--bg-soft);padding:.85rem 1rem;color:var(--text);font-family:'DM Mono',monospace;font-size:.8rem}
    .metric-inline{display:flex;align-items:baseline;gap:.55rem;flex-wrap:wrap}
    .metric-inline__label{color:var(--text-dim);font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}
    .metric-inline strong{font-weight:600;color:var(--text)}
    .summary-item{display:grid;gap:.2rem}
    .summary-item span{color:var(--text-dim);font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}
    .summary-item strong{font-weight:600}
    .summary-item--sales strong{color:var(--success)}
    .summary-item--withdrawals strong{color:var(--danger)}
    .summary-item--balance strong{color:var(--text)}
    .history-header-actions{display:flex;gap:1rem;align-items:center}
    .history-filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;align-items:end;margin-bottom:1rem}
    .history-group{display:grid;gap:1rem}
    .history-session{border:1px solid var(--border);background:var(--bg-soft)}
    .history-session__summary{width:100%;display:grid;gap:1rem;background:transparent;border:none;padding:1rem;text-align:left;cursor:pointer}
    .history-session__headline{display:flex;justify-content:space-between;gap:1rem;align-items:center;color:var(--text);font-family:'DM Mono',monospace;font-size:.8rem}
    .history-session__headline span{color:var(--text-dim);text-transform:uppercase;letter-spacing:.12em;font-size:.68rem}
    .history-session__status--closed{color:var(--danger)!important}
    .history-session__metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem;color:var(--text-soft);font-family:'DM Mono',monospace;font-size:.74rem}
    .history-session__body{padding:0 1rem 1rem}
    .history-session__toolbar{display:flex;justify-content:space-between;gap:1rem;align-items:center;color:var(--text);font-family:'DM Mono',monospace;font-size:.74rem;margin-bottom:.85rem}
    .history-table{overflow:auto;border:1px solid var(--border);background:var(--bg-soft)}
    .history-table table{width:100%;border-collapse:collapse;min-width:860px}
    .history-table th,.history-table td{padding:.8rem .9rem;border-bottom:1px solid var(--border);text-align:left;color:var(--text);font-family:'DM Mono',monospace;font-size:.74rem;vertical-align:top}
    .history-table th{color:var(--text-dim);font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;background:color-mix(in srgb,var(--bg-panel) 88%, transparent)}
    .empty{color:var(--text-soft);font-family:'DM Mono',monospace;font-size:.78rem}
    @media (max-width:920px){
      .inline-form,.inline-form--drawer,.session-metrics,.summary,.history-filters,.history-session__metrics,.drawer-strip{grid-template-columns:1fr}
      .history-session__toolbar,.history-session__headline,.history-header-actions{flex-direction:column;align-items:flex-start}
      .drawer-chip{min-width:unset}

      .history-table table{min-width:0}
      .history-table thead{display:none}
      .history-table tbody,.history-table tr,.history-table td{display:block;width:100%}
      .history-table tr{border:1px solid var(--border);border-radius:3px;background:color-mix(in srgb,var(--bg) 86%, transparent);margin:.6rem;padding:.2rem 0}
      .history-table td{border:none;border-bottom:1px dashed color-mix(in srgb,var(--border) 70%, transparent);padding:.55rem .7rem;font-size:.74rem}
      .history-table td:last-child{border-bottom:none}
      .history-table td::before{display:block;margin-bottom:.2rem;color:var(--text-dim);font-family:'DM Mono',monospace;font-size:.63rem;letter-spacing:.1em;text-transform:uppercase}
      .history-table td:nth-child(1)::before{content:'Movimiento'}
      .history-table td:nth-child(2)::before{content:'Tipo'}
      .history-table td:nth-child(3)::before{content:'Sentido'}
      .history-table td:nth-child(4)::before{content:'Monto'}
      .history-table td:nth-child(5)::before{content:'Descripcion'}
    }
  `]
})
export class CashComponent implements OnInit {
    readonly permissionCodes = PermissionCodes;
    drawerForm: FormGroup;
    openForm: FormGroup;
    withdrawForm: FormGroup;
    closeForm: FormGroup;
    branches: BranchResponse[] = [];
    drawers: CashDrawerResponse[] = [];
    selectedBranchId = '';
    selectedDrawerId = '';
    currentSession: CashSessionResponse | null = null;
    currentSummary: CashSessionSummaryResponse | null = null;
    historySessions: CashSessionView[] = [];
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
        private toast: ToastService,
        private onboardingService: OnboardingService,
        private router: Router,
        public auth: AuthService
    ) {
        this.drawerForm = this.fb.group({ name: ['', Validators.required] });
        this.openForm = this.fb.group({ openingAmount: [0, [Validators.required, Validators.min(0)]], notes: [''] });
        this.withdrawForm = this.fb.group({ amount: [0, [Validators.required, Validators.min(0.01)]], description: ['', Validators.required] });
        this.closeForm = this.fb.group({ actualClosingAmount: [0, [Validators.required, Validators.min(0)]], notes: [''] });
    }

    ngOnInit(): void {
        this.refreshOnboarding();
        this.loadBranches();
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

                if (!this.selectedDrawerId && drawers.length > 0 && (this.showCashDrawerOnboarding || this.showInitialCashOpenOnboarding)) {
                    this.selectDrawer(drawers[0].id);
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
                this.toast.success('Extraccion registrada');
            },
            error: err => this.toast.error(err?.error?.detail || err?.error?.message || 'No se pudo registrar la extraccion')
        });
    }

    closeSession(): void {
        if (!this.currentSession || this.closeForm.invalid) {
            this.closeForm.markAllAsTouched();
            return;
        }

        const { actualClosingAmount, notes } = this.closeForm.getRawValue();
        this.cashService.closeSession(this.currentSession.id, Number(actualClosingAmount), notes).subscribe({
            next: () => {
                this.currentSession = null;
                this.currentSummary = null;
                this.openForm.reset({ openingAmount: 0, notes: '' });
                this.withdrawForm.reset({ amount: 0, description: '' });
                this.closeForm.reset({ actualClosingAmount: 0, notes: '' });
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

    exportSession(session: CashSessionResponse): void {
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
            'Sentido',
            'Monto',
            'Descripcion',
            'Esperado',
            'Cierre real',
            'Diferencia'
        ];

        const body = session.movements.map(movement => [
            session.id,
            session.statusName,
            this.formatDate(session.openedAt),
            this.formatDate(session.closedAt),
            this.formatDate(movement.occurredAt),
            movement.typeName,
            movement.directionName,
            movement.amount.toFixed(2),
            movement.description || '',
            session.expectedClosingAmount.toFixed(2),
            session.actualClosingAmount == null ? '' : session.actualClosingAmount.toFixed(2),
            session.difference.toFixed(2)
        ]);

        this.downloadExcel(`cash-session-${session.openedAt.slice(0, 10)}.xlsx`, headers, body);
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
            'Sentido',
            'Monto',
            'Descripcion',
            'Esperado',
            'Cierre real',
            'Diferencia'
        ];

        const body = this.historySessions.flatMap(item => item.session.movements.map(movement => [
            item.session.id,
            item.session.statusName,
            this.formatDate(item.session.openedAt),
            this.formatDate(item.session.closedAt),
            this.formatDate(movement.occurredAt),
            movement.typeName,
            movement.directionName,
            movement.amount.toFixed(2),
            movement.description || '',
            item.session.expectedClosingAmount.toFixed(2),
            item.session.actualClosingAmount == null ? '' : item.session.actualClosingAmount.toFixed(2),
            item.session.difference.toFixed(2)
        ]));

        const suffix = this.historyFrom || this.historyTo
            ? `${this.historyFrom || 'inicio'}_${this.historyTo || 'hoy'}`
            : new Date().toISOString().slice(0, 10);

        this.downloadExcel(`cash-history-${suffix}.xlsx`, headers, body);
    }

    exportSessionPdf(session: CashSessionResponse): void {
        if (session.movements.length === 0) {
            this.toast.error('La sesion no tiene movimientos para exportar');
            return;
        }

        this.exportSessionsPdf(`cash-session-${session.openedAt.slice(0, 10)}.pdf`, 'Sesion de caja', [session]);
    }

    exportFilteredHistoryPdf(): void {
        if (this.historySessions.length === 0) {
            this.toast.error('No hay sesiones para exportar');
            return;
        }

        const suffix = this.historyFrom || this.historyTo
            ? `${this.historyFrom || 'inicio'}_${this.historyTo || 'hoy'}`
            : new Date().toISOString().slice(0, 10);

        this.exportSessionsPdf(`cash-history-${suffix}.pdf`, 'Historial de caja', this.historySessions.map(item => item.session));
    }

    private exportSessionsPdf(fileName: string, title: string, sessions: CashSessionResponse[]): void {
        const doc = new jsPDF({ format: 'a4', unit: 'mm' });
        const margin = 14;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const maxY = pageHeight - 14;
        let y = 16;

        const drawDocumentHeader = (continuation = false): void => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(25, 25, 25);
            doc.text(continuation ? `${title} (continuacion)` : title, margin, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(95, 95, 95);
            doc.text(`Emitido: ${new Date().toLocaleString('es-AR')}`, pageWidth - margin, y, { align: 'right' });
            y += 6;
            doc.setDrawColor(210, 210, 210);
            doc.line(margin, y, pageWidth - margin, y);
            y += 6;
        };

        const drawMovementHeader = (): void => {
            doc.setFillColor(239, 239, 239);
            doc.setDrawColor(190, 190, 190);
            doc.rect(margin, y, pageWidth - margin * 2, 7, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(35, 35, 35);
            doc.text('Movimiento', margin + 2, y + 4.8);
            doc.text('Tipo', margin + 37, y + 4.8);
            doc.text('Sentido', margin + 67, y + 4.8);
            doc.text('Monto', margin + 93, y + 4.8);
            doc.text('Descripcion', margin + 115, y + 4.8);
            y += 7;
        };

        drawDocumentHeader();

        for (let index = 0; index < sessions.length; index += 1) {
            const session = sessions[index];

            if (y > maxY - 30) {
                doc.addPage();
                y = 16;
                drawDocumentHeader(true);
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.3);
            doc.setTextColor(30, 30, 30);
            doc.text(`Sesion ${session.id} | ${session.statusName}`, margin, y);
            y += 4.8;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.2);
            doc.setTextColor(60, 60, 60);
            const meta = `Apertura: ${this.formatDate(session.openedAt)} | Cierre: ${this.formatDate(session.closedAt) || '-'} | Esperado: ${this.formatCurrency(session.expectedClosingAmount)} | Real: ${session.actualClosingAmount == null ? '-' : this.formatCurrency(session.actualClosingAmount)} | Diferencia: ${this.formatCurrency(session.difference)}`;
            const metaLines = doc.splitTextToSize(meta, pageWidth - margin * 2) as string[];
            doc.text(metaLines, margin, y);
            y += metaLines.length * 4.2;

            drawMovementHeader();

            for (const movement of session.movements) {
                const description = movement.description || '-';
                const descriptionLines = doc.splitTextToSize(description, 78) as string[];
                const clippedDescription = descriptionLines.slice(0, 2);
                const rowHeight = Math.max(6.8, clippedDescription.length * 3.4 + 1.6);

                if (y + rowHeight > maxY) {
                    doc.addPage();
                    y = 16;
                    drawDocumentHeader(true);
                    drawMovementHeader();
                }

                doc.setDrawColor(220, 220, 220);
                doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.9);
                doc.setTextColor(35, 35, 35);
                doc.text(this.formatDate(movement.occurredAt), margin + 2, y + 4.4);
                doc.text(movement.typeName, margin + 37, y + 4.4);
                doc.text(movement.directionName, margin + 67, y + 4.4);
                doc.text(this.formatCurrency(movement.amount), margin + 111, y + 4.4, { align: 'right' });
                doc.text(clippedDescription, margin + 115, y + 4.4);

                y += rowHeight;
            }

            y += 4;
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

        this.cashService.getCurrentSession(this.selectedDrawerId).subscribe({
            next: session => {
                this.currentSession = session;
                this.currentSummary = this.toSummary(session);
                this.loadingSession = false;
            },
            error: () => {
                this.loadingSession = false;
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

        this.cashService.listHistory(this.selectedDrawerId, this.historyFrom || undefined, this.historyTo || undefined).subscribe({
            next: sessions => {
                this.historySessions = sessions.map(session => ({
                    session,
                    expanded: false,
                    salesIncome: this.sumMovementsByType(session.movements, 'SaleIncome'),
                    withdrawals: this.sumMovementsByType(session.movements, 'CashWithdrawal')
                }));
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
            .filter(movement => movement.typeName === 'SaleIncome')
            .reduce((total, movement) => total + movement.amount, 0);

        const withdrawals = session.movements
            .filter(movement => movement.typeName === 'CashWithdrawal')
            .reduce((total, movement) => total + movement.amount, 0);

        return {
            id: session.id,
            openingAmount: session.openingAmount,
            salesIncome,
            withdrawals,
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

    private downloadExcel(fileName: string, headers: string[], body: string[][]): void {
        const rows = body.map(columns =>
            headers.reduce<Record<string, string>>((result, header, index) => {
                result[header] = columns[index] ?? '';
                return result;
            }, {})
        );

        const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Caja');
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

    isClosedSession(statusName?: string | null): boolean {
        return (statusName || '').toLowerCase() === 'closed';
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
