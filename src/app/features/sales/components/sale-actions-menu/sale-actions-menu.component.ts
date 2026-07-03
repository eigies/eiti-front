import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SaleResponse } from '../../../../core/models/sale.models';
import { SaleUiAction } from '../../sales-page-ui.models';

@Component({
    selector: 'app-sale-actions-menu',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './sale-actions-menu.component.html',
    styleUrls: ['./sale-actions-menu.component.css']
})
export class SaleActionsMenuComponent {
    @Input({ required: true }) sale!: SaleResponse;
    @Input() expanded = false;
    @Input() canPay = false;
    @Input() canEdit = false;
    @Input() canDelete = false;
    @Input() canRemitoAmounts = false;
    @Input() canSendWhatsApp = false;
    @Input() paying = false;
    @Input() canceling = false;
    @Input() sendingWhatsApp = false;
    @Output() action = new EventEmitter<SaleUiAction>();

    documentsOpen = false;
    moreOpen = false;

    get isPending(): boolean {
        return this.sale.idSaleStatus === 1;
    }

    get canCancel(): boolean {
        return (this.sale.idSaleStatus === 1 || this.sale.idSaleStatus === 2) && this.canDelete;
    }

    toggleDocuments(event: Event): void {
        event.stopPropagation();
        this.documentsOpen = !this.documentsOpen;
        this.moreOpen = false;
    }

    toggleMore(event: Event): void {
        event.stopPropagation();
        this.moreOpen = !this.moreOpen;
        this.documentsOpen = false;
    }

    emitAction(action: SaleUiAction, event?: Event): void {
        event?.stopPropagation();
        this.closeMenus();
        this.action.emit(action);
    }

    @HostListener('document:click')
    @HostListener('document:keydown.escape')
    closeMenus(): void {
        this.documentsOpen = false;
        this.moreOpen = false;
    }
}
