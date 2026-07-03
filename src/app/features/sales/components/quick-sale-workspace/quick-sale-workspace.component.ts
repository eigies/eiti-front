import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { QuickSaleStage } from '../../sales-page-ui.models';

@Component({
    selector: 'app-quick-sale-workspace',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './quick-sale-workspace.component.html',
    styleUrls: ['./quick-sale-workspace.component.css']
})
export class QuickSaleWorkspaceComponent {
    @Input({ required: true }) activeStage!: QuickSaleStage;
    @Input() configComplete = false;
    @Input() productsComplete = false;
    @Output() stageChange = new EventEmitter<QuickSaleStage>();

    selectStage(stage: QuickSaleStage): void {
        this.stageChange.emit(stage);
    }
}
