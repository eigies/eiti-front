import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UiButtonComponent, UiEmptyComponent } from '../../../shared/ui';
import { BanksFacade, BankView } from '../data-access/banks.facade';
import { BankCardComponent } from '../components/bank-card/bank-card.component';
import { BankFormModalComponent } from '../components/bank-form-modal/bank-form-modal.component';

/** Contenedor de /banks: bancos con sus usos y planes; alta y edición en popup. */
@Component({
  selector: 'app-banks-page',
  standalone: true,
  imports: [CommonModule, UiButtonComponent, UiEmptyComponent, BankCardComponent, BankFormModalComponent],
  providers: [BanksFacade],
  templateUrl: './banks-page.component.html',
  styleUrls: ['./banks-page.component.css']
})
export class BanksPageComponent implements OnInit {
  readonly facade = inject(BanksFacade);
  private readonly destroyRef = inject(DestroyRef);
  createOpen = false;

  ngOnInit(): void {
    this.facade.created$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.createOpen = false);
    this.facade.init();
  }

  trackById(_index: number, view: BankView): number { return view.bank.id; }
}
