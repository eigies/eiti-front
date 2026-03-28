import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BankService } from '../../core/services/bank.service';
import { ToastService } from '../../shared/services/toast.service';
import { BankResponse } from '../../core/models/bank.models';

type BankView = {
  bank: BankResponse;
  expanded: boolean;
  editingPlan: boolean;
};

@Component({
  selector: 'app-banks',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './banks.component.html',
  styleUrls: ['./banks.component.css']
})
export class BanksComponent implements OnInit {
  createForm: FormGroup;
  editForm: FormGroup;
  planForms: Map<number, FormGroup> = new Map();
  banks: BankView[] = [];
  editingBank: BankResponse | null = null;
  savingCreate = false;
  savingEdit = false;
  savingPlan = false;

  readonly VALID_CUOTAS = [1, 3, 6, 9, 12];

  constructor(
    private readonly fb: FormBuilder,
    private readonly bankService: BankService,
    private readonly toast: ToastService
  ) {
    this.createForm = this.fb.group({ name: ['', Validators.required] });
    this.editForm = this.fb.group({ name: ['', Validators.required], active: [true] });
  }

  ngOnInit(): void { this.loadBanks(); }

  loadBanks(): void {
    this.bankService.listBanks(false).subscribe({
      next: banks => this.banks = banks.map(b => ({ bank: b, expanded: false, editingPlan: false })),
      error: () => this.toast.error('No se pudieron cargar los bancos')
    });
  }

  toggleExpand(view: BankView): void {
    view.expanded = !view.expanded;
    if (view.expanded && !this.planForms.has(view.bank.id)) {
      this.initPlanForm(view.bank);
    }
  }

  initPlanForm(bank: BankResponse): void {
    const group: Record<string, unknown> = {};
    for (const cuotas of this.VALID_CUOTAS) {
      const existing = bank.plans.find(p => p.cuotas === cuotas);
      group[`pct_${cuotas}`] = [existing?.surchargePct ?? 0, [Validators.min(0), Validators.max(100)]];
      group[`active_${cuotas}`] = [existing?.active ?? false];
    }
    this.planForms.set(bank.id, this.fb.group(group));
  }

  startEdit(view: BankView): void {
    this.editingBank = view.bank;
    this.editForm.setValue({ name: view.bank.name, active: view.bank.active });
    view.expanded = true;
    if (!this.planForms.has(view.bank.id)) {
      this.initPlanForm(view.bank);
    }
  }

  cancelEdit(): void { this.editingBank = null; }

  toggleActive(view: BankView): void {
    this.bankService.updateBank(view.bank.id, { name: view.bank.name, active: !view.bank.active }).subscribe({
      next: () => {
        view.bank.active = !view.bank.active;
        this.toast.success(view.bank.active ? 'Banco activado' : 'Banco desactivado');
      },
      error: () => this.toast.error('Error al actualizar el estado del banco')
    });
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.savingCreate) return;
    this.savingCreate = true;
    this.bankService.createBank(this.createForm.value.name).subscribe({
      next: () => {
        this.createForm.reset();
        this.savingCreate = false;
        this.loadBanks();
        this.toast.success('Banco creado');
      },
      error: () => { this.savingCreate = false; this.toast.error('Error al crear banco'); }
    });
  }

  submitEdit(): void {
    if (!this.editingBank || this.editForm.invalid || this.savingEdit) return;
    this.savingEdit = true;
    this.bankService.updateBank(this.editingBank.id, this.editForm.value).subscribe({
      next: () => {
        this.editingBank = null;
        this.savingEdit = false;
        this.loadBanks();
        this.toast.success('Banco actualizado');
      },
      error: () => { this.savingEdit = false; this.toast.error('Error al actualizar banco'); }
    });
  }

  savePlan(bankId: number, cuotas: number): void {
    const form = this.planForms.get(bankId);
    if (!form || this.savingPlan) return;
    const surchargePct = Number(form.get(`pct_${cuotas}`)?.value ?? 0);
    const active = !!form.get(`active_${cuotas}`)?.value;
    this.savingPlan = true;
    this.bankService.upsertInstallmentPlan(bankId, { cuotas, surchargePct, active }).subscribe({
      next: () => {
        this.savingPlan = false;
        this.loadBanks();
        this.toast.success(`Plan ${cuotas} cuota${cuotas > 1 ? 's' : ''} guardado`);
      },
      error: () => { this.savingPlan = false; this.toast.error('Error al guardar plan'); }
    });
  }

  getPlanPct(bank: BankResponse, cuotas: number): number {
    return bank.plans.find(p => p.cuotas === cuotas)?.surchargePct ?? 0;
  }

  isPlanActive(bank: BankResponse, cuotas: number): boolean {
    return bank.plans.find(p => p.cuotas === cuotas)?.active ?? false;
  }

  getFormControl(bankId: number, controlName: string): FormControl {
    return (this.planForms.get(bankId)?.get(controlName) ?? new FormControl()) as FormControl;
  }

  trackById(_index: number, view: BankView): number { return view.bank.id; }
}
