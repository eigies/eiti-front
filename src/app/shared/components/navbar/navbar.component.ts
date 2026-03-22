import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
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
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {
  readonly permissionCodes = PermissionCodes;
  companyName = 'Sin compania';
  sidebarOpen = false;

  constructor(
    public auth: AuthService,
    public theme: ThemeService,
    private companyService: CompanyService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.closeSidebar();
      }
    });

    this.companyService.getCurrentCompany().subscribe({
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
    document.body.classList.toggle('sidebar-open', this.sidebarOpen);
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
    document.body.classList.remove('sidebar-open');
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.closeSidebar();
  }
}
