import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ADMIN_NAV, AdminNavGroup } from './admin-nav.config';

/**
 * Sección Administración: menú propio a la izquierda y la pantalla elegida a la derecha.
 * Las rutas de cada pantalla no cambian; solo se envuelven en este contenedor.
 */
@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-shell.component.html',
  styleUrls: ['./admin-shell.component.css']
})
export class AdminShellComponent {
  private readonly auth = inject(AuthService);

  /** Se arma una sola vez: con arreglos nuevos en cada ciclo, routerLinkActive entra en un bucle. */
  readonly groups: AdminNavGroup[] = this.buildGroups();

  private buildGroups(): AdminNavGroup[] {
    const can = (code: string) => this.auth.hasPermission(code);
    return ADMIN_NAV
      .map(group => ({ ...group, links: group.links.filter(link => !link.visible || link.visible(can)) }))
      .filter(group => group.links.length > 0);
  }
}
