import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { CompanyService } from '../../../core/services/company.service';
import { NAV_GROUPS, NavChild, NavGroup, NavItem } from './nav.config';

const RAIL_KEY = 'eiti_nav_rail';

/**
 * Menú lateral EITI 2: fijo a la izquierda en escritorio (se puede achicar a riel),
 * cajón deslizable en tablet y celular. Las rutas y los permisos son los de siempre.
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavbarComponent implements OnInit, OnDestroy {
  companyName = 'Sin compania';
  sidebarOpen = false;
  rail = false;
  url = '';

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    public auth: AuthService,
    public theme: ThemeService,
    private companyService: CompanyService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.url = this.router.url;
    this.rail = this.readRail();
    this.syncBodyClasses();

    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.url = event.urlAfterRedirects || event.url;
        this.closeSidebar();
        this.cdr.markForCheck();
      }
    });

    this.companyService.getCurrentCompany().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: company => { this.companyName = company.name; this.cdr.markForCheck(); },
      error: () => { this.companyName = 'Sin compania'; this.cdr.markForCheck(); }
    });
  }

  ngOnDestroy(): void {
    document.body.classList.remove('sidebar-open', 'nav-shell', 'nav-rail');
  }

  get groups(): NavGroup[] {
    const can = (code: string) => this.auth.hasPermission(code);
    return NAV_GROUPS
      .map(group => ({
        ...group,
        items: group.items
          .filter(item => !item.visible || item.visible(can))
          .map(item => ({ ...item, children: item.children?.filter(child => !child.visible || child.visible(can)) }))
          .filter(item => !!item.link || (item.children?.length ?? 0) > 0)
      }))
      .filter(group => group.items.length > 0);
  }

  linkOf(item: NavItem): string {
    return item.link ?? item.children?.[0]?.link ?? '/dashboard';
  }

  isActive(item: NavItem): boolean {
    const path = this.url.split('?')[0];
    return item.match.some(prefix => path === prefix || path.startsWith(prefix + '/'));
  }

  isChildActive(child: NavChild): boolean {
    const path = this.url.split('?')[0];
    return child.exact ? path === child.link : path === child.link || path.startsWith(child.link + '/');
  }

  get brandIcon(): string {
    return this.theme.isDarkTheme ? 'assets/brand/eiti-icon-dark.svg' : 'assets/brand/eiti-icon-light.svg';
  }

  trackByLabel(_: number, entry: { label: string | null }): string | null {
    return entry.label;
  }

  logout(): void {
    this.closeSidebar();
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
    this.syncBodyClasses();
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
    this.syncBodyClasses();
  }

  toggleRail(): void {
    this.rail = !this.rail;
    try { localStorage.setItem(RAIL_KEY, this.rail ? '1' : '0'); } catch { /* sin almacenamiento */ }
    this.syncBodyClasses();
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.closeSidebar();
  }

  private readRail(): boolean {
    try { return localStorage.getItem(RAIL_KEY) === '1'; } catch { return false; }
  }

  private syncBodyClasses(): void {
    const body = document.body.classList;
    body.add('nav-shell');
    body.toggle('nav-rail', this.rail);
    body.toggle('sidebar-open', this.sidebarOpen);
  }
}
