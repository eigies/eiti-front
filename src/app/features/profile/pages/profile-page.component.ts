import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { UiAvatarComponent, UiButtonComponent, UiEmptyComponent } from '../../../shared/ui';
import { ProfileFacade } from '../data-access/profile.facade';
import { permissionDisplayName } from '../models/profile-view';

/** Contenedor de /profile (Mi cuenta): identidad, permisos efectivos y cambios de perfil. */
@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, UiAvatarComponent, UiButtonComponent, UiEmptyComponent],
  providers: [ProfileFacade],
  templateUrl: './profile-page.component.html',
  styleUrls: ['./profile-page.component.css']
})
export class ProfilePageComponent implements OnInit {
  readonly facade = inject(ProfileFacade);
  readonly permissionName = permissionDisplayName;

  ngOnInit(): void {
    this.facade.init();
  }
}
