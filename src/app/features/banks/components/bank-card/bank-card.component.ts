import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { BankResponse } from '../../../../core/models/bank.models';
import { UiButtonComponent } from '../../../../shared/ui';

/** Un banco: usos con el color del medio, activo como interruptor y planes de cuotas como tarjetas. */
@Component({
  selector: 'app-bank-card',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UiButtonComponent],
  templateUrl: './bank-card.component.html',
  styleUrls: ['./bank-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BankCardComponent {
  @Input({ required: true }) bank!: BankResponse;
  @Input() active = true;
  @Input() expanded = false;
  @Input() planForm: FormGroup | null = null;
  @Input() cuotas: readonly number[] = [];
  @Input() savingPlan = false;
  @Output() toggleExpand = new EventEmitter<void>();
  @Output() toggleActive = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() savePlan = new EventEmitter<number>();

  control(name: string): FormControl {
    return (this.planForm?.get(name) ?? new FormControl()) as FormControl;
  }

  planActive(cuotas: number): boolean {
    return this.bank.plans.find(p => p.cuotas === cuotas)?.active ?? false;
  }
}
