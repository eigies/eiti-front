import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export type GuidedReviewSection = 'customer' | 'address' | 'sale' | 'transport';

/** Repaso final de la Venta guiada: cada bloque con su "Cambiar" que vuelve al paso. Solo presentación. */
@Component({
  selector: 'app-guided-review',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './guided-review.component.html',
  styleUrls: ['./guided-review.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GuidedReviewComponent {
  @Input() customerName = '';
  @Input() document = '';
  @Input() email = '';
  @Input() addressLine = '';
  @Input() addressLocation = '';
  @Input() paid = false;
  @Input() delivery = '';
  @Input() itemCount = 0;
  @Input() branchName = '';
  @Input() paymentPreview = '';
  @Input() paymentCoverage = 0;
  @Input() drawerName = '';
  @Input() requiresDelivery = false;
  @Input() driverName = '';
  @Input() vehicleName = '';
  @Input() transportNotes = '';
  @Output() edit = new EventEmitter<GuidedReviewSection>();
}
