import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { applyGeneralDiscount, GENERAL_DISCOUNT_REASON_MAX_LENGTH, saleDiscountIssue } from '../../../../core/models/sale.models';
import { roundMoney } from '../../../../core/models/sale-payment.models';
import { SaleDiscountDraft } from '../../sales-page-ui.models';

/**
 * "Descuento" de la venta minorista (alta y edicion): un % sobre toda la venta, hasta el tope que fijo
 * el dueño, y un motivo opcional. Plegado muestra el descuento vigente; el padre decide si se ve (tope > 0).
 */
@Component({
    selector: 'app-sale-discount-control',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './sale-discount-control.component.html',
    styleUrls: ['./sale-discount-control.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SaleDiscountControlComponent implements OnChanges {
    @Input({ required: true }) draft!: SaleDiscountDraft;
    /** Tope de la empresa (0-100). */
    @Input({ required: true }) maxPercent = 0;
    /** Total antes del descuento: renglones + recargo sin envio. */
    @Input() subtotal = 0;
    /** % que la venta ya tenia al editarla: si no cambia, no se vuelve a validar contra el tope. */
    @Input() originalPercent: number | null = null;

    @Output() readonly draftChange = new EventEmitter<SaleDiscountDraft>();

    readonly reasonMaxLength = GENERAL_DISCOUNT_REASON_MAX_LENGTH;
    // Controles propios y no [value]: reescribir el input en cada tecla le borraba al vendedor el "7." de "7.5".
    readonly percentControl = new FormControl<number | null>(null);
    readonly reasonControl = new FormControl<string>('', { nonNullable: true });

    constructor() {
        this.percentControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(value => this.setPercent(value));
        this.reasonControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(value => this.setReason(value));
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (!changes['draft'] || !this.draft) {
            return;
        }
        if (this.parsePercent(this.percentControl.value) !== this.draft.percent) {
            this.percentControl.setValue(this.draft.percent > 0 ? this.draft.percent : null, { emitEvent: false });
        }
        if (this.reasonControl.value !== this.draft.reason) {
            this.reasonControl.setValue(this.draft.reason, { emitEvent: false });
        }
    }

    get limitLabel(): string {
        return this.maxPercent > 0 ? `hasta ${this.maxPercent}%` : 'sin máximo fijado';
    }

    get issue(): string | null {
        return saleDiscountIssue(this.draft.percent, this.maxPercent, this.originalPercent);
    }

    get discountAmount(): number {
        return roundMoney(this.subtotal - applyGeneralDiscount(this.subtotal, this.draft.percent));
    }

    get hasDiscount(): boolean {
        return this.draft.percent > 0;
    }

    toggle(): void {
        this.draftChange.emit({ ...this.draft, open: !this.draft.open });
    }

    clear(): void {
        this.draftChange.emit({ open: false, percent: 0, reason: '' });
    }

    setPercent(raw: string | number | null): void {
        this.draftChange.emit({ ...this.draft, percent: this.parsePercent(raw) });
    }

    setReason(reason: string): void {
        this.draftChange.emit({ ...this.draft, reason });
    }

    private parsePercent(raw: string | number | null): number {
        if (raw === null || raw === '') {
            return 0;
        }
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : 0;
    }
}
