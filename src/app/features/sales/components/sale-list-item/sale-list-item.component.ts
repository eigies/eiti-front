import { Component, HostBinding, Input } from '@angular/core';

@Component({
    selector: 'article[appSaleListItem]',
    standalone: true,
    templateUrl: './sale-list-item.component.html',
    styleUrls: ['./sale-list-item.component.css']
})
export class SaleListItemComponent {
    @Input() expanded = false;

    @HostBinding('class.sale-list-item') readonly itemClass = true;
    @HostBinding('attr.role') readonly role = 'row';

    @HostBinding('attr.aria-expanded')
    get ariaExpanded(): string {
        return String(this.expanded);
    }
}
