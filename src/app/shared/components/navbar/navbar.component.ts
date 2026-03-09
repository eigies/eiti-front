import { Component, HostListener, OnInit } from '@angular/core';
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
export class NavbarComponent implements OnInit {
  readonly permissionCodes = PermissionCodes;
  companyName = 'Sin compania';
  mobileMenuOpen = false;

  constructor(
    public auth: AuthService,
    public theme: ThemeService,
    private companyService: CompanyService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.mobileMenuOpen = false;
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

  logout(): void {
    this.mobileMenuOpen = false;
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.mobileMenuOpen = false;
  }
}
