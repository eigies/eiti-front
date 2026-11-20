import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

const TONES = ['teal', 'indigo', 'orange', 'purple', 'cyan', 'pink', 'lime'] as const;

/** Inicial de color: el mismo color siempre para la misma clave (id o nombre). */
@Component({
  selector: 'ui-avatar',
  standalone: true,
  templateUrl: './ui-avatar.component.html',
  styleUrls: ['./ui-avatar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiAvatarComponent {
  @Input() name = '';
  @Input() key = '';
  @Input() size = 40;

  get initial(): string {
    return (this.name || '?').trim().charAt(0).toUpperCase() || '?';
  }

  get tone(): string {
    const source = this.key || this.name || '';
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
      hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
    }
    return TONES[hash % TONES.length];
  }
}
