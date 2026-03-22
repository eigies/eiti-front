import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgIf } from '@angular/common';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ThemeService } from './core/services/theme.service';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent, NavbarComponent, NgIf],
  template: `
    <app-navbar *ngIf="isAuthenticated"></app-navbar>
    <div class="app-content">
      <router-outlet></router-outlet>
    </div>
    <app-toast></app-toast>
  `,
  styles: []
})
export class AppComponent {
  constructor(private readonly themeService: ThemeService, private readonly auth: AuthService) {
    void this.themeService;
  }

  get isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }
}
