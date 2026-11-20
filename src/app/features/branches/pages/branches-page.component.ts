import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BranchResponse } from '../../../core/models/branch.models';
import { OnboardingBannerComponent } from '../../../shared/components/onboarding-banner/onboarding-banner.component';
import { UiButtonComponent, UiCardComponent, UiEmptyComponent } from '../../../shared/ui';
import { BranchFormModalComponent } from '../components/branch-form-modal/branch-form-modal.component';
import { BranchTableComponent } from '../components/branch-table/branch-table.component';
import { StockTransferModalComponent } from '../components/stock-transfer-modal/stock-transfer-modal.component';
import { BranchesFacade } from '../data-access/branches.facade';

/** Contenedor de /branches: tabla de sucursales, alta, edición y traspaso de stock en popups. */
@Component({
  selector: 'app-branches-page',
  standalone: true,
  imports: [CommonModule, OnboardingBannerComponent, UiButtonComponent, UiCardComponent, UiEmptyComponent, BranchTableComponent, BranchFormModalComponent, StockTransferModalComponent],
  providers: [BranchesFacade],
  templateUrl: './branches-page.component.html',
  styleUrls: ['./branches-page.component.css']
})
export class BranchesPageComponent implements OnInit {
  readonly facade = inject(BranchesFacade);
  private readonly destroyRef = inject(DestroyRef);

  createOpen = false;
  transferOpen = false;

  readonly invoicingOf = (branch: BranchResponse): string => this.facade.branchInvoicingLabel(branch);
  readonly originOf = (branch: BranchResponse): string => this.facade.branchInvoicingOrigin(branch);
  readonly automaticOf = (branch: BranchResponse): boolean | null => this.facade.branchInvoicesAutomatically(branch);
  readonly pointOfSaleOf = (branch: BranchResponse): string => this.facade.branchPointOfSaleLabel(branch);
  readonly productOptionsFor = (index: number) => this.facade.productOptionsForLine(index);
  readonly availableFor = (productId: string | null | undefined) => this.facade.availableForProduct(productId);

  ngOnInit(): void {
    this.facade.created$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.createOpen = false);
    this.facade.transferred$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.transferOpen = false);
    this.facade.init();
  }
}
