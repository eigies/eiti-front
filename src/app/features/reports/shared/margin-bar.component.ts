import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DecimalPipe, NgIf } from '@angular/common';

/** Margen en barrita: la barra llega al tope con 50% de margen (scale 2); el número va al lado. */
@Component({
  selector: 'app-margin-bar',
  standalone: true,
  imports: [DecimalPipe, NgIf],
  templateUrl: './margin-bar.component.html',
  styleUrls: ['./margin-bar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MarginBarComponent {
  @Input() value: number | null = null;
  /** Cuánto se estira la barra por cada punto: 2 = tope en 50%, 1 = tope en 100%. */
  @Input() scale = 2;

  get width(): number {
    const value = Number(this.value ?? 0);
    return Math.max(0, Math.min(100, value * this.scale));
  }

  get negative(): boolean {
    return Number(this.value ?? 0) < 0;
  }
}
