import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-onboarding-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './onboarding-banner.component.html',
  styleUrls: ['./onboarding-banner.component.css']
})
export class OnboardingBannerComponent {
  @Input() eyebrow = 'Configuracion inicial';
  @Input() title = '';
  @Input() text = '';
  @Input() step = 1;
  @Input() total = 4;
  @Input() actionLabel = '';
  @Input() actionDisabled = false;
  @Input() focused = false;
  @Input() variant: 'default' | 'success' = 'default';
  @Output() action = new EventEmitter<void>();

  get progress(): number {
    if (this.total <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, (this.step / this.total) * 100));
  }
}
