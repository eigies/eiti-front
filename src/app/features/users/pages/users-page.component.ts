import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UiButtonComponent } from '../../../shared/ui';
import { AccessProfileListComponent } from '../components/access-profile-list/access-profile-list.component';
import { AccessProfilePanelComponent } from '../components/access-profile-panel/access-profile-panel.component';
import { UserAccessListComponent } from '../components/user-access-list/user-access-list.component';
import { UserAccessPanelComponent } from '../components/user-access-panel/user-access-panel.component';
import { UsersFacade } from '../data-access/users.facade';

/**
 * Contenedor de /users (Administración > Usuarios y perfiles): pestañas Usuarios / Perfiles,
 * altas y ediciones en popup. El estado y las reglas viven en UsersFacade.
 */
@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [
    CommonModule,
    UiButtonComponent,
    UserAccessListComponent,
    UserAccessPanelComponent,
    AccessProfileListComponent,
    AccessProfilePanelComponent
  ],
  providers: [UsersFacade],
  templateUrl: './users-page.component.html',
  styleUrls: ['./users-page.component.css']
})
export class UsersPageComponent implements OnInit {
  readonly facade = inject(UsersFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  ngOnInit(): void {
    this.facade.userPanelClosed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(preferredUserId => this.restoreFocusAfterUserPanel(preferredUserId));
    this.facade.init();
  }

  onSectionTabKeydown(event: KeyboardEvent): void {
    const tabs = Array.from(
      (event.currentTarget as HTMLElement | null)
        ?.parentElement
        ?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []
    );
    const currentIndex = tabs.indexOf(event.currentTarget as HTMLElement);
    if (currentIndex < 0 || tabs.length === 0) return;

    let targetIndex: number;
    switch (event.key) {
      case 'ArrowRight':
        targetIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        targetIndex = 0;
        break;
      case 'End':
        targetIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const target = tabs[targetIndex];
    this.facade.selectSection(target.id === 'profiles-tab' ? 'profiles' : 'users');
    target.focus();
  }

  /** Después de cerrar el popup, el foco vuelve a la fila creada o al botón de alta. */
  private restoreFocusAfterUserPanel(preferredUserId?: string): void {
    setTimeout(() => {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement !== document.body) return;

      const preferredAction = preferredUserId
        ? this.createdUserEditAction(preferredUserId)
        : null;
      const fallback = preferredAction
        ?? this.host.nativeElement.querySelector<HTMLElement>('#users-create')
        ?? this.host.nativeElement.querySelector<HTMLElement>('#user-list-title');
      if (!fallback) return;
      if (!fallback.matches('button, a, input, select, textarea, [tabindex]')) {
        fallback.tabIndex = -1;
      }
      fallback.focus();
    });
  }

  private createdUserEditAction(userId: string): HTMLElement | null {
    const row = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('[data-user-id]')
    ).find(candidate => candidate.dataset['userId'] === userId);
    return row?.querySelector<HTMLElement>('.user-list__open') ?? null;
  }
}
