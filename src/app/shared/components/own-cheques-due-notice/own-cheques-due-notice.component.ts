import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, merge } from 'rxjs';
import { OwnChequeDue } from '../../../core/models/cheque.models';
import { PermissionCodes } from '../../../core/models/permission.models';
import { AuthService } from '../../../core/services/auth.service';
import { ChequeService } from '../../../core/services/cheque.service';
import { formatShortDate } from '../../utils/ledger-format.util';
import { formatMoney } from '../../utils/money.util';

const NOTICE = 'own-cheques';

/**
 * Aviso de los cheques propios que vencen hoy, una vez por día y por usuario. Mira al iniciar sesión y en
 * cada navegación: la sesión puede quedar abierta de un día para el otro y ahí no hay login que lo dispare.
 * Queda visto recién al cerrarlo, y solo si había cheques: recargar con el aviso abierto no lo pierde, y un
 * día sin cheques no gasta el aviso. Si la consulta falla, reintenta en la próxima navegación.
 */
@Component({
  selector: 'app-own-cheques-due-notice',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './own-cheques-due-notice.component.html',
  styleUrls: ['./own-cheques-due-notice.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnChequesDueNoticeComponent implements OnInit {
  cheques: OwnChequeDue[] = [];
  private checking = false;
  /** Evita preguntar en cada navegación cuando hoy no había cheques; dura hasta recargar la página. */
  private checkedOn: string | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly chequeService: ChequeService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    merge(this.auth.currentUser$, this.router.events.pipe(filter(event => event instanceof NavigationEnd)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.check());
  }

  private check(): void {
    if (this.checking || this.cheques.length > 0) return;
    if (!this.auth.isAuthenticated() || !this.auth.hasPermission(PermissionCodes.chequesManage)) return;
    if (!this.auth.isDailyNoticePending(NOTICE)) return;

    const today = new Date().toLocaleDateString('en-CA');
    if (this.checkedOn === today) return;

    this.checking = true;
    this.chequeService.listOwnDue().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: cheques => {
        this.checking = false;
        this.checkedOn = today;
        this.cheques = cheques;
        this.cdr.markForCheck();
      },
      error: () => { this.checking = false; }
    });
  }

  get total(): number {
    return this.cheques.reduce((sum, cheque) => sum + cheque.monto, 0);
  }

  /** La fecha solo se muestra si no vence hoy (el lunes, los que vencieron el fin de semana). */
  dueLabel(cheque: OwnChequeDue): string | null {
    const today = new Date().toLocaleDateString('en-CA');
    return cheque.fechaVencimiento.slice(0, 10) === today ? null : `Venció el ${formatShortDate(cheque.fechaVencimiento)}`;
  }

  money(value: number): string {
    return formatMoney(value);
  }

  goToCheques(): void {
    this.close();
    void this.router.navigate(['/cheques']);
  }

  @HostListener('document:keydown.escape')
  close(): void {
    if (this.cheques.length > 0) this.auth.markDailyNoticeSeen(NOTICE);
    this.cheques = [];
    this.cdr.markForCheck();
  }
}
