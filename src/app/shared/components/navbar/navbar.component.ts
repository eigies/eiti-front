import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { PermissionCodes } from '../../../core/models/permission.models';
import { CompanyService } from '../../../core/services/company.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavbarComponent implements OnInit, OnDestroy {
  readonly permissionCodes = PermissionCodes;
  companyName = 'Sin compania';
  sidebarOpen = false;
  salesMenuOpen = false;
  clientsMenuOpen = false;
  cashMenuOpen = false;
  purchasesMenuOpen = false;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    public auth: AuthService,
    public theme: ThemeService,
    private companyService: CompanyService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.salesMenuOpen = this.router.url.startsWith('/sales');
    this.clientsMenuOpen = this.router.url.startsWith('/customers') || this.router.url.startsWith('/clients');
    this.cashMenuOpen = this.router.url.startsWith('/cash');
    this.purchasesMenuOpen = this.router.url.startsWith('/purchases') || this.router.url.startsWith('/suppliers');

    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.closeSidebar();
        if (event.url.startsWith('/sales')) {
          this.salesMenuOpen = true;
        }
        if (event.url.startsWith('/customers') || event.url.startsWith('/clients')) {
          this.clientsMenuOpen = true;
        }
        if (event.url.startsWith('/cash')) {
          this.cashMenuOpen = true;
        }
        if (event.url.startsWith('/purchases') || event.url.startsWith('/suppliers')) {
          this.purchasesMenuOpen = true;
        }
      }
    });

    this.companyService.getCurrentCompany().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: company => {
        this.companyName = company.name;
      },
      error: () => {
        this.companyName = 'Sin compania';
      }
    });
  }

  ngOnDestroy(): void {
    document.body.classList.remove('sidebar-open');
  }

  logout(): void {
    this.closeSidebar();
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
    if (this.sidebarOpen) {
      this.salesMenuOpen = this.router.url.startsWith('/sales');
      this.clientsMenuOpen = this.router.url.startsWith('/customers') || this.router.url.startsWith('/clients');
      this.purchasesMenuOpen = this.router.url.startsWith('/purchases') || this.router.url.startsWith('/suppliers');
    }
    document.body.classList.toggle('sidebar-open', this.sidebarOpen);
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
    document.body.classList.remove('sidebar-open');
  }

  toggleSalesMenu(): void {
    this.salesMenuOpen = !this.salesMenuOpen;
  }

  toggleClientsMenu(): void {
    this.clientsMenuOpen = !this.clientsMenuOpen;
  }

  toggleCashMenu(): void {
    this.cashMenuOpen = !this.cashMenuOpen;
  }

  togglePurchasesMenu(): void {
    this.purchasesMenuOpen = !this.purchasesMenuOpen;
  }

  get isCashRouteActive(): boolean {
    return this.router.url.startsWith('/cash');
  }

  get isSalesRouteActive(): boolean {
    return this.router.url.startsWith('/sales');
  }

  get isClientsRouteActive(): boolean {
    return this.router.url.startsWith('/customers') || this.router.url.startsWith('/clients');
  }

  get isPurchasesRouteActive(): boolean {
    return this.router.url.startsWith('/purchases') || this.router.url.startsWith('/suppliers');
  }

  get hasAnyReportsPermission(): boolean {
    const p = this.permissionCodes;
    return [
      p.reportsAudit, p.reportsSalesModel, p.reportsSalesComparison, p.reportsSalesTransport,
      p.reportsSalesChannel, p.reportsSalesChannelBrand, p.reportsSalesBrand, p.reportsSalesRanking,
      p.reportsSalesDailyControl, p.reportsDebtors, p.reportsCash, p.reportsStock
    ].some(code => this.auth.hasPermission(code));
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.closeSidebar();
  }
}
