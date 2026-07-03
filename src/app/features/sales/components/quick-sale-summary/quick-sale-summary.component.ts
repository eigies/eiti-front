import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { QuickSaleStage } from '../../sales-page-ui.models';

export interface QuickSaleSummaryItem {
    id: string;
    label: string;
    quantity: number;
    subtotal: number;
}

@Component({
    selector: 'app-quick-sale-summary',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './quick-sale-summary.component.html',
    styleUrls: ['./quick-sale-summary.component.css']
})
export class QuickSaleSummaryComponent {
    @Input({ required: true }) activeStage!: QuickSaleStage;
    @Input() branch = 'Sin seleccionar';
    @Input() channel = 'Sin seleccionar';
    @Input() delivery = 'Retira cliente';
    @Input() customer = 'Consumidor final';
    @Input() productCount = 0;
    @Input() items: QuickSaleSummaryItem[] = [];
    @Input() total = 0;
    @Input() saving = false;
    @Output() primaryAction = new EventEmitter<void>();
    @Output() productsRequested = new EventEmitter<void>();

    get visibleItems(): QuickSaleSummaryItem[] {
        return this.items.slice(0, 3);
    }

    get hiddenItemCount(): number {
        return Math.max(0, this.items.length - this.visibleItems.length);
    }

    get actionLabel(): string {
        if (this.saving) return 'Guardando...';
        if (this.activeStage === 'config') return 'Continuar a productos';
        if (this.activeStage === 'products') return 'Continuar al cobro';
        return 'Confirmar venta';
    }

    handlePrimaryAction(): void {
        if (!this.saving) {
            this.primaryAction.emit();
        }
    }

    requestProducts(): void {
        this.productsRequested.emit();
    }
}
