import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

export type UiButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';
export type UiButtonSize = 'sm' | 'md' | 'lg';

/** Botón EITI 2: `<button uiBtn="primary">`. Íconos de línea de 18 px adentro. */
@Component({
  selector: 'button[uiBtn], a[uiBtn]',
  standalone: true,
  templateUrl: './ui-button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiButtonComponent {
  @Input() uiBtn: UiButtonVariant | '' = 'secondary';
  @Input() size: UiButtonSize = 'md';
  @Input() block = false;
  @Input() iconOnly = false;

  @HostBinding('class')
  get hostClass(): string {
    const variant = this.uiBtn || 'secondary';
    return [
      'ui-btn',
      `ui-btn--${variant}`,
      this.size !== 'md' ? `ui-btn--${this.size}` : '',
      this.block ? 'ui-btn--block' : '',
      this.iconOnly ? 'ui-btn--icon' : ''
    ].filter(Boolean).join(' ');
  }
}
